"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { headers } from "next/headers";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { feeStructures, invoices, memberships, payments, schools, students, users } from "@/db/schema";
import { logAudit } from "@/lib/audit";

// Staff allowed to record payments / issue fees. Bursars and senior staff manage finance, not just
// the owner-admin.
const FINANCE_ROLES = ["school_admin", "bursar", "principal", "vice_principal"];

async function ctx() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (!m) return null;
  const [school] = await db.select({ requireApproval: schools.requireApproval }).from(schools).where(eq(schools.id, m.schoolId)).limit(1);
  return { userId: session.user.id, schoolId: m.schoolId, role: m.role, canRecord: FINANCE_ROLES.includes(m.role), canApprove: m.role === "school_admin" || m.canApprovePayments, requireApproval: !!school?.requireApproval };
}

export type Payment = { id: string; student: string; admissionNo: string; amount: number; method: string; status: string; recordedBy: string; approver: string | null; mine: boolean; date: string; description: string | null; proofKey: string | null; receiptKey: string | null };
export type FeeItem = { name: string; amount: number; mandatory: boolean };
export type Fee = { id: string; name: string; termLabel: string | null; amount: number; classes: string[]; items: FeeItem[] };
export type InvoiceRow = { id: string; no: string; studentId: string; student: string; admissionNo: string; description: string; amount: number; paid: number; outstanding: number; status: string; date: string; mandatory: boolean };
export type OpenInvoice = { id: string; studentId: string; no: string; description: string; amount: number; outstanding: number };
export type ReceiptRow = { id: string; no: string; student: string; amount: number; method: string; date: string; token: string | null };
export type ClassCount = { className: string; count: number };
export type Student = { id: string; name: string; admissionNo: string; className: string | null };
export type FinanceData = {
  stats: { collected: number; outstanding: number; outstandingCount: number; pending: number; pendingCount: number; thisMonth: number; receiptsIssued: number };
  payments: Payment[];
  fees: Fee[];
  students: Student[];
  invoices: InvoiceRow[];
  openInvoices: OpenInvoice[];
  receipts: ReceiptRow[];
  classCounts: ClassCount[];
  classSummary: ClassSummary[];
  canRecord: boolean;
  canApprove: boolean;
  requireApproval: boolean;
};
export type ClassSummary = { className: string; students: number; invoiced: number; collected: number; outstanding: number };

const invNo = (id: string) => `INV-${id.slice(0, 8).toUpperCase()}`;
const rcpNo = (id: string) => `RCP-${id.slice(0, 8).toUpperCase()}`;

// Student name + class for human-readable audit entries.
async function studentLabel(studentId: string): Promise<{ student: string; className: string | null }> {
  const [s] = await db.select({ fn: students.firstName, ln: students.lastName, cls: students.className }).from(students).where(eq(students.id, studentId)).limit(1);
  return { student: s ? `${s.fn} ${s.ln}`.trim() : "", className: s?.cls ?? null };
}

export async function getFinanceData(): Promise<FinanceData | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  const recorder = users;
  const approver = alias(users, "approver");
  const [rows, studentRows, feeRows, invoiceRows, paidRows, classRows, invByClass, paidByClass] = await Promise.all([
    db.select({ id: payments.id, amount: payments.amount, method: payments.method, status: payments.status, description: payments.description, createdAt: payments.createdAt, recordedByUserId: payments.recordedByUserId, proofKey: payments.proofKey, receiptKey: payments.receiptKey, sf: students.firstName, sl: students.lastName, admissionNo: students.admissionNo, recordedBy: recorder.name, approverName: approver.name })
      .from(payments).innerJoin(students, eq(students.id, payments.studentId)).leftJoin(recorder, eq(recorder.id, payments.recordedByUserId)).leftJoin(approver, eq(approver.id, payments.approvedByUserId))
      .where(eq(payments.schoolId, c.schoolId)).orderBy(desc(payments.createdAt)).limit(100),
    db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName, admissionNo: students.admissionNo, className: students.className }).from(students).where(eq(students.schoolId, c.schoolId)).orderBy(desc(students.createdAt)).limit(500),
    db.select().from(feeStructures).where(eq(feeStructures.schoolId, c.schoolId)).orderBy(desc(feeStructures.createdAt)),
    db.select({ id: invoices.id, studentId: invoices.studentId, description: invoices.description, amount: invoices.amount, mandatory: invoices.mandatory, createdAt: invoices.createdAt, sf: students.firstName, sl: students.lastName, admissionNo: students.admissionNo })
      .from(invoices).innerJoin(students, eq(students.id, invoices.studentId)).where(eq(invoices.schoolId, c.schoolId)).orderBy(desc(invoices.createdAt)).limit(500),
    db.select({ invoiceId: payments.invoiceId, paid: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.schoolId, c.schoolId), eq(payments.status, "approved"))).groupBy(payments.invoiceId),
    db.select({ className: students.className, count: sql<number>`count(*)::int` }).from(students).where(eq(students.schoolId, c.schoolId)).groupBy(students.className),
    db.select({ className: students.className, total: sql<string>`coalesce(sum(${invoices.amount}), 0)` }).from(invoices).innerJoin(students, eq(students.id, invoices.studentId)).where(eq(invoices.schoolId, c.schoolId)).groupBy(students.className),
    db.select({ className: students.className, total: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).innerJoin(students, eq(students.id, payments.studentId)).where(and(eq(payments.schoolId, c.schoolId), eq(payments.status, "approved"))).groupBy(students.className),
  ]);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let collected = 0, pending = 0, pendingCount = 0, thisMonth = 0, receiptsIssued = 0;
  const list: Payment[] = rows.map((r) => {
    const amt = Number(r.amount);
    if (r.status === "approved") { collected += amt; receiptsIssued += 1; if (new Date(r.createdAt) >= monthStart) thisMonth += amt; }
    if (r.status === "pending_approval") { pending += amt; pendingCount += 1; }
    return { id: r.id, student: `${r.sf} ${r.sl}`.trim(), admissionNo: r.admissionNo, amount: amt, method: r.method, status: r.status, recordedBy: r.recordedBy ?? "-", approver: r.status === "approved" ? r.approverName ?? null : null, mine: r.recordedByUserId === c.userId, date: new Date(r.createdAt).toLocaleDateString(), description: r.description, proofKey: r.proofKey, receiptKey: r.receiptKey };
  });

  // Per-invoice reconciliation: how much approved money has been applied to each invoice.
  const paidMap = new Map<string, number>();
  for (const p of paidRows) if (p.invoiceId) paidMap.set(p.invoiceId, Number(p.paid));
  let outstanding = 0, outstandingCount = 0;
  const invoiceList: InvoiceRow[] = [];
  const openInvoices: OpenInvoice[] = [];
  for (const inv of invoiceRows) {
    const amount = Number(inv.amount);
    const paid = paidMap.get(inv.id) ?? 0;
    const due = Math.max(0, amount - paid);
    const status = paid <= 0 ? "outstanding" : paid >= amount ? "paid" : "partially_paid";
    // Only mandatory items count toward what a student/school owes; optional items are billed but
    // don't block clearance.
    if (due > 0 && inv.mandatory) { outstanding += due; outstandingCount += 1; }
    const desc = inv.description || "School fees";
    invoiceList.push({ id: inv.id, no: invNo(inv.id), studentId: inv.studentId, student: `${inv.sf} ${inv.sl}`.trim(), admissionNo: inv.admissionNo, description: desc, amount, paid, outstanding: due, status, date: new Date(inv.createdAt).toLocaleDateString(), mandatory: inv.mandatory });
    if (due > 0) openInvoices.push({ id: inv.id, studentId: inv.studentId, no: invNo(inv.id), description: desc, amount, outstanding: due });
  }

  const receipts: ReceiptRow[] = rows.filter((r) => r.status === "approved").slice(0, 12).map((r) => ({ id: r.id, no: rcpNo(r.id), student: `${r.sf} ${r.sl}`.trim(), amount: Number(r.amount), method: r.method, date: new Date(r.createdAt).toLocaleDateString(), token: r.receiptKey }));

  // Per-class financials: expected (invoiced), collected (approved), and outstanding for each class.
  const csMap = new Map<string, { invoiced: number; collected: number }>();
  const keyOf = (cn: string | null) => cn || "Unassigned";
  for (const r of invByClass) { const k = keyOf(r.className); const e = csMap.get(k) ?? { invoiced: 0, collected: 0 }; e.invoiced += Number(r.total); csMap.set(k, e); }
  for (const r of paidByClass) { const k = keyOf(r.className); const e = csMap.get(k) ?? { invoiced: 0, collected: 0 }; e.collected += Number(r.total); csMap.set(k, e); }
  const countMap = new Map(classRows.map((r) => [keyOf(r.className), Number(r.count)]));
  const classSummary: ClassSummary[] = [...csMap.entries()]
    .map(([className, v]) => ({ className, students: countMap.get(className) ?? 0, invoiced: v.invoiced, collected: v.collected, outstanding: Math.max(0, v.invoiced - v.collected) }))
    .filter((c) => c.invoiced > 0 || c.collected > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  return {
    stats: { collected, outstanding, outstandingCount, pending, pendingCount, thisMonth, receiptsIssued },
    payments: list,
    fees: feeRows.map((f) => ({ id: f.id, name: f.name, termLabel: f.termLabel, amount: Number(f.amount), classes: Array.isArray(f.classes) ? (f.classes as string[]) : [], items: Array.isArray(f.items) ? (f.items as FeeItem[]) : [] })),
    students: studentRows.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`.trim(), admissionNo: s.admissionNo, className: s.className })),
    invoices: invoiceList.slice(0, 12),
    openInvoices,
    receipts,
    classCounts: classRows.filter((r) => r.className).map((r) => ({ className: r.className as string, count: Number(r.count) })),
    classSummary,
    canRecord: c.canRecord,
    canApprove: c.canApprove,
    requireApproval: c.requireApproval,
  };
}

// Creates a fee bill made of one or more line items (e.g. Tuition, Excursion, PTA), each marked
// mandatory or optional, and issues one invoice per item to each targeted student. When `classes`
// is empty the bill applies to every student; otherwise only to students in those classes.
export type FeeItemInput = { name: string; amount: number; mandatory: boolean };
export async function createFeeStructure(input: { name: string; termLabel?: string; dueDate?: string; classes?: string[]; items: FeeItemInput[] }): Promise<{ ok: true; issued: number } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (!c.canRecord) return { error: "You don't have permission to issue fees." };
  if (!input.name.trim()) return { error: "Give the bill a name." };
  const items = (input.items ?? []).map((it) => ({ name: it.name.trim(), amount: Number(it.amount), mandatory: !!it.mandatory })).filter((it) => it.name && it.amount > 0);
  if (items.length === 0) return { error: "Add at least one fee item with an amount." };
  const total = items.reduce((n, it) => n + it.amount, 0);
  const classes = (input.classes ?? []).map((s) => s.trim()).filter(Boolean);
  try {
    const { feeId, issued } = await db.transaction(async (tx) => {
      const [fee] = await tx.insert(feeStructures).values({ schoolId: c.schoolId, name: input.name.trim(), termLabel: input.termLabel?.trim() || null, amount: total.toFixed(2), appliesTo: classes.length ? "classes" : "all", classes, items }).returning();
      const studentRows = await tx.select({ id: students.id }).from(students)
        .where(classes.length ? and(eq(students.schoolId, c.schoolId), inArray(students.className, classes)) : eq(students.schoolId, c.schoolId));
      if (studentRows.length) {
        const rows = studentRows.flatMap((s) => items.map((it) => ({ schoolId: c.schoolId, studentId: s.id, feeStructureId: fee.id, description: it.name, amount: it.amount.toFixed(2), mandatory: it.mandatory, dueDate: input.dueDate || null })));
        await tx.insert(invoices).values(rows);
      }
      return { feeId: fee.id, issued: studentRows.length };
    });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "fees.issued", entityType: "Fee", entityId: feeId, metadata: { name: input.name.trim(), amount: total, items: items.length, issued, classes: classes.length ? classes : "all" } });
    return { ok: true, issued };
  } catch {
    return { error: "Could not create the bill. Please try again." };
  }
}

// Accepts a FormData so an optional proof-of-payment image (bank transfer screenshot / receipt)
// can ride along with the fields. The proof is written under public/uploads and its path stored.
export async function recordPayment(form: FormData): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (!c.canRecord) return { error: "You don't have permission to record payments." };
  const studentId = String(form.get("studentId") || "");
  const amount = Number(form.get("amount") || 0);
  const method = String(form.get("method") || "cash");
  const description = String(form.get("description") || "").trim();
  const invoiceId = String(form.get("invoiceId") || "").trim() || null;
  if (!studentId) return { error: "Please select a student." };
  if (!(amount > 0)) return { error: "Enter a valid amount." };
  if (method === "transfer" && !(form.get("proof") instanceof File && (form.get("proof") as File).size > 0)) return { error: "Proof of payment is required for transfers." };
  // Validate the chosen invoice belongs to this school + student.
  if (invoiceId) {
    const [inv] = await db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.schoolId, c.schoolId), eq(invoices.studentId, studentId))).limit(1);
    if (!inv) return { error: "That invoice doesn't match the selected student." };
  }
  let proofKey: string | null = null;
  const proof = form.get("proof");
  if (proof instanceof File && proof.size > 0) {
    if (proof.size > 6 * 1024 * 1024) return { error: "Proof image must be under 6MB." };
    const ext = (proof.type.split("/")[1] || "png").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "png";
    const name = `proof-${randomUUID()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(await proof.arrayBuffer()));
    proofKey = `/uploads/${name}`;
  }
  try {
    const [row] = await db.insert(payments).values({ schoolId: c.schoolId, studentId, invoiceId, amount: amount.toFixed(2), method: method === "transfer" ? "transfer" : "cash", status: "pending_approval", description: description || null, recordedByUserId: c.userId, proofKey }).returning({ id: payments.id });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "payment.recorded", entityType: "Payment", entityId: row?.id, metadata: { amount, method, ...(await studentLabel(studentId)) } });
    return { ok: true };
  } catch {
    return { error: "Could not record the payment. Please try again." };
  }
}

// Maker-checker: an approver can never approve a payment they recorded (enforced here AND by a
// DB check constraint as a backstop).
export async function approvePayment(id: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canApprove) return { error: "You don't have approval rights." };
  const [p] = await db.select().from(payments).where(and(eq(payments.id, id), eq(payments.schoolId, c.schoolId))).limit(1);
  if (!p) return { error: "Payment not found." };
  if (p.status !== "pending_approval") return { error: "This payment was already processed." };
  // Maker-checker is only enforced when the school opts into it (Settings → "separate approver").
  if (c.requireApproval && p.recordedByUserId === c.userId) return { error: "Maker-checker is on: a different staff member must approve this payment." };
  try {
    await db.update(payments).set({ status: "approved", approvedByUserId: c.userId, approvedAt: new Date(), receiptKey: p.receiptKey || randomUUID(), updatedAt: new Date() }).where(eq(payments.id, id));
    if (p.invoiceId) await reconcileInvoice(p.invoiceId, c.schoolId);
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "payment.approved", entityType: "Payment", entityId: id, metadata: { amount: Number(p.amount), ...(await studentLabel(p.studentId)) } });
    return { ok: true };
  } catch {
    return { error: "Could not approve the payment. Please try again." };
  }
}

// Recomputes an invoice's status from the sum of its approved payments (paid / partially_paid / outstanding).
async function reconcileInvoice(invoiceId: string, schoolId: string) {
  const [inv] = await db.select({ amount: invoices.amount }).from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.schoolId, schoolId))).limit(1);
  if (!inv) return;
  const [{ paid }] = await db.select({ paid: sql<string>`coalesce(sum(${payments.amount}), 0)` }).from(payments).where(and(eq(payments.invoiceId, invoiceId), eq(payments.status, "approved")));
  const total = Number(inv.amount), p = Number(paid);
  const status = p <= 0 ? "outstanding" : p >= total ? "paid" : "partially_paid";
  await db.update(invoices).set({ status, updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
}

export async function rejectPayment(id: string, reason: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canApprove) return { error: "You don't have approval rights." };
  const [p] = await db.select().from(payments).where(and(eq(payments.id, id), eq(payments.schoolId, c.schoolId))).limit(1);
  if (!p || p.status !== "pending_approval") return { error: "This payment was already processed." };
  try {
    await db.update(payments).set({ status: "rejected", rejectedReason: reason.trim() || "Rejected", updatedAt: new Date() }).where(eq(payments.id, id));
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "payment.rejected", entityType: "Payment", entityId: id, metadata: { amount: Number(p.amount), reason: reason.trim() || "Rejected", ...(await studentLabel(p.studentId)) } });
    return { ok: true };
  } catch {
    return { error: "Could not reject the payment." };
  }
}
