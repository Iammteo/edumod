"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/context";
import { accounts, invoices, payments, schools, students, studentResults, refundRequests, users } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { gradeFor } from "@/lib/grading";
import { generateStudentPassword } from "@/lib/identity/password";
import { hashPassword } from "./people";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { sniffImage } from "@/lib/image-upload";
import { computeStudentFinance } from "@/lib/finance-calc";

async function ctx() {
  const a = await getAuthContext();
  if (!a) return null;
  const canManage = a.role === "school_admin" || a.role === "teacher" || a.role === "principal" || a.role === "vice_principal" || a.role === "secretary";
  const canApprove = a.role === "school_admin" || a.canApprovePayments;
  // Students/parents must never reach staff readers; only leadership may bulk-recover login secrets.
  const isStaff = ["school_admin", "principal", "vice_principal", "secretary", "teacher"].includes(a.role);
  const canViewSecrets = ["school_admin", "principal", "vice_principal"].includes(a.role);
  return { userId: a.userId, schoolId: a.schoolId, role: a.role, canManage, canApprove, isStaff, canViewSecrets };
}

export type Guardian = { name: string; relationship: string; phone: string; email: string; occupation: string; address: string };
export type Emergency = { name: string; relationship: string; phone: string };
export type StudentBio = {
  sex: string; dateOfBirth: string; genotype: string; bloodGroup: string; house: string; arm: string;
  nationality: string; stateOfOrigin: string; lga: string; religion: string; address: string;
  medicalNotes: string; allergies: string; specialSupport: string; dietaryNotes: string; notes: string;
  guardian1: Guardian; guardian2: Guardian; emergency: Emergency;
};
export type SubjectResult = { subject: string; ca: number; exam: number; total: number; grade: string };
export type TermResult = { term: string; subjects: SubjectResult[]; total: number; average: number; grade: string; remark: string; position: number | null; classSize: number };
export type LedgerEntry = { date: string; description: string; method: string | null; amount: number; balance: number; receiptNo: string | null; kind: "invoice" | "payment" };
export type InvoiceItem = { description: string; amount: number; status: string; date: string; mandatory: boolean };
export type StudentPayment = { id: string; amount: number; method: string; status: string; date: string; receiptKey: string | null; receiptNo: string; description: string | null };
export type StudentProfile = {
  id: string; name: string; admissionNo: string; className: string | null; photoKey: string | null; enrolledOn: string;
  bio: StudentBio;
  summary: { average: number | null; position: number | null; classSize: number };
  financial: { invoiced: number; paid: number; outstanding: number; optionalDue: number; credit: number; nextDue: string | null; payments: StudentPayment[]; invoiceItems: InvoiceItem[]; ledger: LedgerEntry[]; refunds: RefundRow[] };
  academics: TermResult[];
  canManage: boolean;
  canApprove: boolean;
  canRemove: boolean;
};
export type RefundRow = { id: string; amount: number; status: string; reason: string | null; date: string };

const emptyGuardian = (): Guardian => ({ name: "", relationship: "", phone: "", email: "", occupation: "", address: "" });
const s = (v: unknown) => (typeof v === "string" ? v : "");
function readGuardian(v: unknown): Guardian {
  const g = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { name: s(g.name), relationship: s(g.relationship), phone: s(g.phone), email: s(g.email), occupation: s(g.occupation), address: s(g.address) };
}
function readBio(profile: unknown, dob: string | null): StudentBio {
  const p = (profile && typeof profile === "object" ? profile : {}) as Record<string, unknown>;
  const em = (p.emergency && typeof p.emergency === "object" ? p.emergency : {}) as Record<string, unknown>;
  return {
    sex: s(p.sex), dateOfBirth: s(p.dateOfBirth) || dob || "", genotype: s(p.genotype), bloodGroup: s(p.bloodGroup), house: s(p.house), arm: s(p.arm),
    nationality: s(p.nationality), stateOfOrigin: s(p.stateOfOrigin), lga: s(p.lga), religion: s(p.religion), address: s(p.address),
    medicalNotes: s(p.medicalNotes), allergies: s(p.allergies), specialSupport: s(p.specialSupport), dietaryNotes: s(p.dietaryNotes), notes: s(p.notes),
    guardian1: readGuardian(p.guardian1 ?? p.guardian), // back-compat with the old single `guardian`
    guardian2: readGuardian(p.guardian2),
    emergency: { name: s(em.name), relationship: s(em.relationship), phone: s(em.phone) },
  };
}

const invNo = (id: string) => `INV-${id.slice(0, 8).toUpperCase()}`;
const rcpNo = (id: string) => `RCP-${id.slice(0, 8).toUpperCase()}`;

export async function getStudentProfile(studentId: string): Promise<StudentProfile | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (!c.isStaff) return { error: "Not authorised." };
  const [stu] = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.schoolId, c.schoolId))).limit(1);
  if (!stu) return { error: "Student not found." };

  const [invRows, payRows, paidByInv, refundRows] = await Promise.all([
    db.select({ id: invoices.id, description: invoices.description, amount: invoices.amount, mandatory: invoices.mandatory, status: invoices.status, dueDate: invoices.dueDate, createdAt: invoices.createdAt }).from(invoices).where(eq(invoices.studentId, studentId)).orderBy(asc(invoices.createdAt)),
    db.select({ id: payments.id, amount: payments.amount, method: payments.method, status: payments.status, createdAt: payments.createdAt, receiptKey: payments.receiptKey, description: payments.description }).from(payments).where(eq(payments.studentId, studentId)).orderBy(desc(payments.createdAt)).limit(100),
    db.select({ invoiceId: payments.invoiceId, paid: sql<string>`sum(${payments.amount})` }).from(payments).where(and(eq(payments.studentId, studentId), eq(payments.status, "approved"))).groupBy(payments.invoiceId),
    db.select({ id: refundRequests.id, amount: refundRequests.amount, status: refundRequests.status, reason: refundRequests.reason, createdAt: refundRequests.createdAt }).from(refundRequests).where(eq(refundRequests.studentId, studentId)).orderBy(desc(refundRequests.createdAt)),
  ]);

  const paid = payRows.filter((p) => p.status === "approved").reduce((n, r) => n + Number(r.amount), 0);
  const refundedApproved = refundRows.filter((r) => r.status === "approved").reduce((n, r) => n + Number(r.amount), 0);
  // Canonical per-student finance (mandatory-first; see lib/finance-calc.ts).
  const { invoiced, optionalInvoiced, outstanding, optionalDue, credit } = computeStudentFinance(invRows.map((r) => ({ amount: Number(r.amount), mandatory: r.mandatory })), paid, refundedApproved);
  const refunds: RefundRow[] = refundRows.map((r) => ({ id: r.id, amount: Number(r.amount), status: r.status, reason: r.reason, date: new Date(r.createdAt).toLocaleDateString() }));
  const paidMap = new Map<string, number>();
  for (const r of paidByInv) if (r.invoiceId) paidMap.set(r.invoiceId, Number(r.paid));

  const invoiceItems: InvoiceItem[] = invRows.map((inv) => {
    const amount = Number(inv.amount), p = paidMap.get(inv.id) ?? 0;
    const status = p <= 0 ? "outstanding" : p >= amount ? "paid" : "partially_paid";
    return { description: inv.description || "School fees", amount, status, date: new Date(inv.createdAt).toLocaleDateString(), mandatory: inv.mandatory };
  });
  // Next due: earliest due date among invoices not fully paid.
  const nextDue = invRows.filter((inv) => (paidMap.get(inv.id) ?? 0) < Number(inv.amount) && inv.dueDate).map((inv) => inv.dueDate as string).sort()[0] ?? null;

  // Ledger: invoices add to the balance owed; approved payments reduce it. Running balance over time.
  type Ev = { ts: number; date: string; description: string; method: string | null; amount: number; receiptNo: string | null; kind: "invoice" | "payment" };
  const events: Ev[] = [];
  for (const inv of invRows) events.push({ ts: new Date(inv.createdAt).getTime(), date: new Date(inv.createdAt).toLocaleDateString(), description: `${inv.description || "Fee"} issued`, method: null, amount: Number(inv.amount), receiptNo: invNo(inv.id), kind: "invoice" });
  for (const p of payRows) if (p.status === "approved") events.push({ ts: new Date(p.createdAt).getTime(), date: new Date(p.createdAt).toLocaleDateString(), description: p.description || "Payment", method: p.method, amount: -Number(p.amount), receiptNo: p.receiptKey ? rcpNo(p.id) : null, kind: "payment" });
  events.sort((a, b) => a.ts - b.ts);
  let bal = 0;
  const ledger: LedgerEntry[] = events.map((e) => { bal += e.amount; return { date: e.date, description: e.description, method: e.method, amount: e.amount, balance: Math.max(0, bal), receiptNo: e.receiptNo, kind: e.kind }; }).reverse();

  const financial = {
    invoiced, paid, outstanding, optionalDue, credit, nextDue,
    payments: payRows.map((p) => ({ id: p.id, amount: Number(p.amount), method: p.method, status: p.status, date: new Date(p.createdAt).toLocaleDateString(), receiptKey: p.receiptKey, receiptNo: rcpNo(p.id), description: p.description })),
    invoiceItems, ledger, refunds,
  };

  // Academics
  const rows = await db.select().from(studentResults).where(eq(studentResults.studentId, studentId)).orderBy(asc(studentResults.term), asc(studentResults.subject));
  const byTerm = new Map<string, SubjectResult[]>();
  for (const r of rows) {
    const total = r.ca + r.exam;
    const list = byTerm.get(r.term) ?? [];
    list.push({ subject: r.subject, ca: r.ca, exam: r.exam, total, grade: gradeFor(total).grade });
    byTerm.set(r.term, list);
  }
  const academics: TermResult[] = [];
  for (const [term, subjects] of byTerm) {
    const total = subjects.reduce((n, x) => n + x.total, 0);
    const average = subjects.length ? Math.round((total / subjects.length) * 10) / 10 : 0;
    const { grade, remark } = gradeFor(average);
    let position: number | null = null, classSize = 0;
    if (stu.className) {
      const mates = await db.select({ id: students.id }).from(students).where(and(eq(students.schoolId, c.schoolId), eq(students.className, stu.className)));
      const mateIds = mates.map((m) => m.id);
      if (mateIds.length) {
        const mateRes = await db.select({ studentId: studentResults.studentId, ca: studentResults.ca, exam: studentResults.exam }).from(studentResults).where(and(eq(studentResults.term, term), inArray(studentResults.studentId, mateIds)));
        const agg = new Map<string, { sum: number; n: number }>();
        for (const r of mateRes) { const a = agg.get(r.studentId) ?? { sum: 0, n: 0 }; a.sum += r.ca + r.exam; a.n += 1; agg.set(r.studentId, a); }
        const ranked = [...agg.entries()].map(([id, a]) => ({ id, avg: a.n ? a.sum / a.n : 0 })).sort((x, y) => y.avg - x.avg);
        classSize = ranked.length;
        const idx = ranked.findIndex((r) => r.id === studentId);
        if (idx >= 0) position = idx + 1;
      }
    }
    academics.push({ term, subjects, total, average, grade, remark, position, classSize });
  }
  academics.sort((a, b) => b.term.localeCompare(a.term));
  const latest = academics[0];
  const summary = { average: latest ? latest.average : null, position: latest?.position ?? null, classSize: latest?.classSize ?? 0 };

  return {
    id: stu.id, name: `${stu.firstName} ${stu.lastName}`.trim(), admissionNo: stu.admissionNo, className: stu.className, photoKey: stu.photoKey,
    enrolledOn: new Date(stu.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
    bio: readBio(stu.profile, stu.dateOfBirth), summary, financial, academics, canManage: c.canManage, canApprove: c.canApprove, canRemove: c.role === "school_admin",
  };
}

export async function updateStudentProfile(studentId: string, input: { className?: string; bio: StudentBio }): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to edit students." };
  const [stu] = await db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName, profile: students.profile, dateOfBirth: students.dateOfBirth, className: students.className }).from(students).where(and(eq(students.id, studentId), eq(students.schoolId, c.schoolId))).limit(1);
  if (!stu) return { error: "Student not found." };
  const b = input.bio;
  const oldBio = readBio(stu.profile, stu.dateOfBirth);
  const t = (v: string) => v?.trim() || "";
  const g = (x: Guardian): Guardian => ({ name: t(x.name), relationship: t(x.relationship), phone: t(x.phone), email: t(x.email), occupation: t(x.occupation), address: t(x.address) });
  const profile = {
    sex: t(b.sex), dateOfBirth: t(b.dateOfBirth), genotype: t(b.genotype), bloodGroup: t(b.bloodGroup), house: t(b.house), arm: t(b.arm),
    nationality: t(b.nationality), stateOfOrigin: t(b.stateOfOrigin), lga: t(b.lga), religion: t(b.religion), address: t(b.address),
    medicalNotes: t(b.medicalNotes), allergies: t(b.allergies), specialSupport: t(b.specialSupport), dietaryNotes: t(b.dietaryNotes), notes: t(b.notes),
    guardian1: g(b.guardian1), guardian2: g(b.guardian2),
    emergency: { name: t(b.emergency.name), relationship: t(b.emergency.relationship), phone: t(b.emergency.phone) },
  };
  // Field-level diff so the audit log can show exactly what changed (old → new).
  const changes: { field: string; old: string; new: string }[] = [];
  const cmp = (label: string, o: string, n: string) => { if ((o || "") !== (n || "")) changes.push({ field: label, old: o || "-", new: n || "-" }); };
  cmp("Class", stu.className || "", input.className?.trim() || "");
  ([["sex", "Sex"], ["dateOfBirth", "Date of birth"], ["genotype", "Genotype"], ["bloodGroup", "Blood group"], ["house", "House"], ["arm", "Arm"], ["religion", "Religion"], ["nationality", "Nationality"], ["stateOfOrigin", "State of origin"], ["lga", "LGA"], ["address", "Address"], ["medicalNotes", "Medical note"], ["allergies", "Allergies"], ["specialSupport", "Special support"], ["dietaryNotes", "Dietary notes"], ["notes", "Notes"]] as [keyof StudentBio, string][]).forEach(([k, label]) => cmp(label, String(oldBio[k] || ""), String((b as Record<string, unknown>)[k] || "")));
  (["guardian1", "guardian2"] as const).forEach((gk, i) => (["name", "relationship", "phone", "email", "occupation", "address"] as const).forEach((f) => cmp(`Guardian ${i + 1} ${f}`, oldBio[gk][f], b[gk][f])));
  (["name", "relationship", "phone"] as const).forEach((f) => cmp(`Emergency ${f}`, oldBio.emergency[f], b.emergency[f]));

  try {
    await db.update(students).set({ profile, className: input.className?.trim() || null, dateOfBirth: profile.dateOfBirth || null, updatedAt: new Date() }).where(eq(students.id, studentId));
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "student.updated", entityType: "Student", entityId: studentId, metadata: { name: `${stu.firstName} ${stu.lastName}`.trim(), className: input.className?.trim() || null, changes } });
    return { ok: true };
  } catch {
    return { error: "Could not save the profile. Please try again." };
  }
}

export async function saveStudentResult(input: { studentId: string; term: string; subject: string; ca: number; exam: number }): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to record results." };
  const [stu] = await db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName }).from(students).where(and(eq(students.id, input.studentId), eq(students.schoolId, c.schoolId))).limit(1);
  if (!stu) return { error: "Student not found." };
  const term = input.term.trim(), subject = input.subject.trim();
  if (!term || !subject) return { error: "Term and subject are required." };
  const ca = Math.round(input.ca), exam = Math.round(input.exam);
  if (ca < 0 || ca > 40) return { error: "CA must be between 0 and 40." };
  if (exam < 0 || exam > 60) return { error: "Exam must be between 0 and 60." };
  try {
    await db.insert(studentResults).values({ schoolId: c.schoolId, studentId: input.studentId, term, subject, ca, exam })
      .onConflictDoUpdate({ target: [studentResults.studentId, studentResults.term, studentResults.subject], set: { ca, exam, updatedAt: new Date() } });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "result.recorded", entityType: "Result", entityId: input.studentId, metadata: { term, subject, student: `${stu.firstName} ${stu.lastName}`.trim() } });
    return { ok: true };
  } catch {
    return { error: "Could not save the result. Please try again." };
  }
}

export async function deleteStudentResult(input: { studentId: string; term: string; subject: string }): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission." };
  await db.delete(studentResults).where(and(eq(studentResults.schoolId, c.schoolId), eq(studentResults.studentId, input.studentId), eq(studentResults.term, input.term.trim()), eq(studentResults.subject, input.subject.trim())));
  return { ok: true };
}

// Regenerates a student's login password (school-branded) and returns it once to hand over.
export async function regenerateStudentPassword(studentId: string): Promise<{ ok: true; password: string; studentName: string } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to reset passwords." };
  const [stu] = await db.select({ userId: students.userId, fn: students.firstName, ln: students.lastName }).from(students).where(and(eq(students.id, studentId), eq(students.schoolId, c.schoolId))).limit(1);
  if (!stu?.userId) return { error: "This student has no login account." };
  const [school] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, c.schoolId)).limit(1);
  const password = generateStudentPassword(school?.name);
  try {
    const hash = await hashPassword(password);
    await db.update(accounts).set({ password: hash, updatedAt: new Date() }).where(and(eq(accounts.userId, stu.userId), eq(accounts.providerId, "credential")));
    await db.update(students).set({ credentialEnc: encryptSecret(password), updatedAt: new Date() }).where(eq(students.id, studentId));
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "student.password_reset", entityType: "Student", entityId: stu.userId, metadata: { name: `${stu.fn} ${stu.ln}`.trim() } });
    return { ok: true, password, studentName: `${stu.fn} ${stu.ln}`.trim() };
  } catch {
    return { error: "Could not reset the password. Please try again." };
  }
}

// View a student's current login password. Possible only for passwords set after credential storage
// was enabled (stored encrypted at rest); older ones return null and must be reset once to capture.
// Admin/teacher only, and every view is audit-logged.
export async function getStudentPassword(studentId: string): Promise<{ ok: true; password: string | null; studentName: string } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to view student passwords." };
  const [stu] = await db.select({ enc: students.credentialEnc, fn: students.firstName, ln: students.lastName, userId: students.userId }).from(students).where(and(eq(students.id, studentId), eq(students.schoolId, c.schoolId))).limit(1);
  if (!stu) return { error: "Student not found." };
  const password = decryptSecret(stu.enc);
  if (password) await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "student.password_viewed", entityType: "Student", entityId: stu.userId ?? studentId, metadata: { name: `${stu.fn} ${stu.ln}`.trim() } });
  return { ok: true, password, studentName: `${stu.fn} ${stu.ln}`.trim() };
}

// Live login credentials for the Logins view: each student's current (decrypted) password. Passwords
// set before credential storage was enabled show as null until reset. Admin/teacher only; audited.
export type StudentCredential = { id: string; name: string; admissionNo: string; className: string | null; password: string | null };
export async function getStudentCredentials(input: { className?: string }): Promise<{ ok: true; rows: StudentCredential[]; matched: number } | { error: string }> {
  const c = await ctx();
  if (!c?.canViewSecrets) return { error: "Only an admin can view student logins in bulk." };
  const className = input.className?.trim();
  const where = className ? and(eq(students.schoolId, c.schoolId), eq(students.className, className)) : eq(students.schoolId, c.schoolId);
  const all = await db.select({ id: students.id, fn: students.firstName, ln: students.lastName, admissionNo: students.admissionNo, className: students.className, enc: students.credentialEnc }).from(students).where(where).orderBy(asc(students.className), asc(students.firstName));
  const rows = all.slice(0, 500).map((r) => ({ id: r.id, name: `${r.fn} ${r.ln}`.trim(), admissionNo: r.admissionNo, className: r.className, password: decryptSecret(r.enc) }));
  await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "students.credentials_viewed", entityType: "Student", metadata: { count: rows.length, className: className ?? "all" } });
  return { ok: true, rows, matched: all.length };
}

// Reset logins for a specific set of students (by students.id) and return the new credentials.
export async function resetStudentPasswords(input: { studentIds: string[] }): Promise<{ ok: true; credentials: Credential[] } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to reset student logins." };
  const ids = Array.from(new Set((input.studentIds ?? []).filter(Boolean))).slice(0, 250);
  if (ids.length === 0) return { error: "Select at least one student." };
  const [school] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, c.schoolId)).limit(1);
  const rows = (await db.select({ id: students.id, userId: students.userId, fn: students.firstName, ln: students.lastName, admissionNo: students.admissionNo, className: students.className }).from(students).where(and(eq(students.schoolId, c.schoolId), inArray(students.id, ids)))).filter((r) => r.userId);
  if (rows.length === 0) return { error: "No matching students with logins." };
  const creds = rows.map((r) => ({ ...r, password: generateStudentPassword(school?.name), hash: "" }));
  for (const cr of creds) cr.hash = await hashPassword(cr.password);
  try {
    await db.transaction(async (tx) => {
      for (const cr of creds) {
        await tx.update(accounts).set({ password: cr.hash, updatedAt: new Date() }).where(and(eq(accounts.userId, cr.userId!), eq(accounts.providerId, "credential")));
        await tx.update(students).set({ credentialEnc: encryptSecret(cr.password), updatedAt: new Date() }).where(eq(students.id, cr.id));
      }
    });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "students.passwords_reset", entityType: "Student", metadata: { count: creds.length, scope: "selected" } });
    return { ok: true, credentials: creds.map((cr) => ({ name: `${cr.fn} ${cr.ln}`.trim(), studentId: cr.admissionNo, password: cr.password, className: cr.className })) };
  } catch {
    return { error: "Could not reset the selected logins. Please try again." };
  }
}

// Permanently removes a student + their login. Admin only, and blocked once they have payment
// records (delete would erase the financial trail - those students should be withdrawn, not deleted).
export async function removeStudent(studentId: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (c?.role !== "school_admin") return { error: "Only an admin can remove a student." };
  const [stu] = await db.select({ userId: students.userId, fn: students.firstName, ln: students.lastName }).from(students).where(and(eq(students.id, studentId), eq(students.schoolId, c.schoolId))).limit(1);
  if (!stu) return { error: "Student not found." };
  const [pay] = await db.select({ id: payments.id }).from(payments).where(eq(payments.studentId, studentId)).limit(1);
  if (pay) return { error: "This student has payment records and can't be deleted. Their history must be kept." };
  try {
    await db.transaction(async (tx) => {
      await tx.delete(students).where(eq(students.id, studentId)); // cascades invoices, results, refunds
      if (stu.userId) await tx.delete(users).where(eq(users.id, stu.userId)); // cascades membership + account
    });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "student.removed", entityType: "Student", entityId: studentId, metadata: { name: `${stu.fn} ${stu.ln}`.trim() } });
    return { ok: true };
  } catch {
    return { error: "Could not remove the student. Please try again." };
  }
}

// Bulk-resets logins for a class (or all students) and returns the new credentials once, for a
// printable sheet. Existing passwords can't be shown (they're hashed) - this regenerates them.
export type Credential = { name: string; studentId: string; password: string; className: string | null };
export async function bulkResetPasswords(input: { className?: string }): Promise<{ ok: true; credentials: Credential[] } | { error: string }> {
  const c = await ctx();
  if (c?.role !== "school_admin") return { error: "Only an admin can reset student logins in bulk." };
  const [school] = await db.select({ name: schools.name }).from(schools).where(eq(schools.id, c.schoolId)).limit(1);
  const className = input.className?.trim();
  const where = className ? and(eq(students.schoolId, c.schoolId), eq(students.className, className)) : eq(students.schoolId, c.schoolId);
  const rows = (await db.select({ userId: students.userId, fn: students.firstName, ln: students.lastName, admissionNo: students.admissionNo, className: students.className }).from(students).where(where).orderBy(asc(students.className), asc(students.firstName)).limit(300)).filter((r) => r.userId);
  if (rows.length === 0) return { error: "No students with logins in that scope." };
  if (rows.length > 250) return { error: "Too many at once - reset by class instead (up to 250)." };
  const creds = rows.map((r) => ({ ...r, password: generateStudentPassword(school?.name), hash: "" }));
  for (const cr of creds) cr.hash = await hashPassword(cr.password);
  try {
    await db.transaction(async (tx) => {
      for (const cr of creds) { await tx.update(accounts).set({ password: cr.hash, updatedAt: new Date() }).where(and(eq(accounts.userId, cr.userId!), eq(accounts.providerId, "credential"))); await tx.update(students).set({ credentialEnc: encryptSecret(cr.password), updatedAt: new Date() }).where(eq(students.userId, cr.userId!)); }
    });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "students.passwords_reset", entityType: "Student", metadata: { count: creds.length, className: className ?? "all" } });
    return { ok: true, credentials: creds.map((cr) => ({ name: `${cr.fn} ${cr.ln}`.trim(), studentId: cr.admissionNo, password: cr.password, className: cr.className })) };
  } catch {
    return { error: "Could not reset the passwords. Please try again." };
  }
}

export async function uploadStudentPhoto(form: FormData): Promise<{ ok: true; url: string } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission." };
  const studentId = String(form.get("studentId") || "");
  const [stu] = await db.select({ id: students.id }).from(students).where(and(eq(students.id, studentId), eq(students.schoolId, c.schoolId))).limit(1);
  if (!stu) return { error: "Student not found." };
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Please choose an image." };
  if (file.size > 5_000_000) return { error: "Image must be under 5MB." };
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniffImage(buf);
  if (!ext) return { error: "That file isn't a supported image (PNG, JPG, GIF or WebP)." };
  try {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const name = `student-${studentId}.${ext}`;
    await writeFile(path.join(dir, name), buf);
    const key = `/uploads/${name}?t=${Date.now()}`;
    await db.update(students).set({ photoKey: `/uploads/${name}`, updatedAt: new Date() }).where(eq(students.id, studentId));
    return { ok: true, url: key };
  } catch {
    return { error: "Could not upload the photo. Please try again." };
  }
}
