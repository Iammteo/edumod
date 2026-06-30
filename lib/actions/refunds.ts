"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/context";
import { invoices, payments, refundRequests, schools, students, users } from "@/db/schema";
import { logAudit } from "@/lib/audit";

// Distinguishes a business-rule rejection (shown to the user) from an unexpected DB error inside the
// refund transaction.
class RefundError extends Error {}
const MAX_AMOUNT = 100_000_000;

async function ctx() {
  const a = await getAuthContext();
  if (!a) return null;
  const [school] = await db.select({ requireApproval: schools.requireApproval }).from(schools).where(eq(schools.id, a.schoolId)).limit(1);
  // Secretary can manage/request refunds but never approve them (separation of duties).
  return { userId: a.userId, schoolId: a.schoolId, role: a.role, canManage: a.role === "school_admin" || a.role === "secretary", canApprove: a.role !== "secretary" && (a.role === "school_admin" || a.canApprovePayments), requireApproval: !!school?.requireApproval };
}

// Credit = approved payments − amount billed − refunds already approved. Positive means overpaid.
export async function creditBalance(studentId: string, schoolId: string): Promise<number> {
  const [inv] = await db.select({ t: sql<string>`coalesce(sum(${invoices.amount}),0)` }).from(invoices).where(and(eq(invoices.studentId, studentId), eq(invoices.schoolId, schoolId)));
  const [pay] = await db.select({ t: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(payments).where(and(eq(payments.studentId, studentId), eq(payments.schoolId, schoolId), eq(payments.status, "approved")));
  const [ref] = await db.select({ t: sql<string>`coalesce(sum(${refundRequests.amount}),0)` }).from(refundRequests).where(and(eq(refundRequests.studentId, studentId), eq(refundRequests.schoolId, schoolId), eq(refundRequests.status, "approved")));
  return Math.max(0, Number(pay.t) - Number(inv.t) - Number(ref.t));
}

async function studentName(studentId: string) {
  const [s] = await db.select({ fn: students.firstName, ln: students.lastName }).from(students).where(eq(students.id, studentId)).limit(1);
  return s ? `${s.fn} ${s.ln}`.trim() : "student";
}

// School-wide overpayment view: every student in credit (paid more than billed, net of approved
// refunds) plus the refund-request queue. Backs the Overpayments & refunds screen.
export type OverpaymentRow = { studentId: string; student: string; admissionNo: string; className: string | null; credit: number };
export type RefundRow = { id: string; studentId: string; student: string; amount: number; status: string; reason: string | null; requestedBy: string | null; mine: boolean; date: string };
export async function getOverpayments(): Promise<{ credits: OverpaymentRow[]; requests: RefundRow[]; totalCredit: number; pending: number; canManage: boolean; canApprove: boolean; requireApproval: boolean } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (!c.canManage) return { error: "Not authorised." };
  const [billed, paid, refunded, studentRows, reqRows] = await Promise.all([
    db.select({ sid: invoices.studentId, t: sql<string>`coalesce(sum(${invoices.amount}),0)` }).from(invoices).where(eq(invoices.schoolId, c.schoolId)).groupBy(invoices.studentId),
    db.select({ sid: payments.studentId, t: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(payments).where(and(eq(payments.schoolId, c.schoolId), eq(payments.status, "approved"))).groupBy(payments.studentId),
    db.select({ sid: refundRequests.studentId, t: sql<string>`coalesce(sum(${refundRequests.amount}),0)` }).from(refundRequests).where(and(eq(refundRequests.schoolId, c.schoolId), eq(refundRequests.status, "approved"))).groupBy(refundRequests.studentId),
    db.select({ id: students.id, fn: students.firstName, ln: students.lastName, admissionNo: students.admissionNo, className: students.className }).from(students).where(eq(students.schoolId, c.schoolId)),
    db.select({ id: refundRequests.id, sid: refundRequests.studentId, amount: refundRequests.amount, status: refundRequests.status, reason: refundRequests.reason, createdAt: refundRequests.createdAt, requestedByUserId: refundRequests.requestedByUserId, sf: students.firstName, sl: students.lastName, by: users.name }).from(refundRequests).innerJoin(students, eq(students.id, refundRequests.studentId)).leftJoin(users, eq(users.id, refundRequests.requestedByUserId)).where(eq(refundRequests.schoolId, c.schoolId)).orderBy(desc(refundRequests.createdAt)).limit(50),
  ]);
  const billedM = new Map(billed.map((r) => [r.sid, Number(r.t)]));
  const refundedM = new Map(refunded.map((r) => [r.sid, Number(r.t)]));
  const credits: OverpaymentRow[] = paid.map((r) => {
    const credit = Number(r.t) - (billedM.get(r.sid) ?? 0) - (refundedM.get(r.sid) ?? 0);
    const s = studentRows.find((x) => x.id === r.sid);
    return { studentId: r.sid, student: s ? `${s.fn} ${s.ln}`.trim() : "Student", admissionNo: s?.admissionNo ?? "-", className: s?.className ?? null, credit };
  }).filter((r) => r.credit > 0).sort((a, b) => b.credit - a.credit);
  const requests: RefundRow[] = reqRows.map((r) => ({ id: r.id, studentId: r.sid, student: `${r.sf} ${r.sl}`.trim(), amount: Number(r.amount), status: r.status, reason: r.reason, requestedBy: r.by ?? null, mine: r.requestedByUserId === c.userId, date: new Date(r.createdAt).toLocaleDateString() }));
  return { credits, requests, totalCredit: credits.reduce((n, r) => n + r.credit, 0), pending: requests.filter((r) => r.status === "pending").length, canManage: c.canManage, canApprove: c.canApprove, requireApproval: c.requireApproval };
}

export async function carryForwardCredit(studentId: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission." };
  const credit = await creditBalance(studentId, c.schoolId);
  if (credit <= 0) return { error: "This student has no credit to carry forward." };
  await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "credit.carried_forward", entityType: "Finance", entityId: studentId, metadata: { amount: credit, student: await studentName(studentId) } });
  return { ok: true };
}

export async function requestRefund(input: { studentId: string; amount: number; reason?: string }): Promise<{ ok: true; approved: boolean } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to request a refund." };
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { error: "Enter a valid refund amount." };
  if (input.amount > MAX_AMOUNT) return { error: "That refund amount is too large." };
  const [stu] = await db.select({ id: students.id }).from(students).where(and(eq(students.id, input.studentId), eq(students.schoolId, c.schoolId))).limit(1);
  if (!stu) return { error: "Student not found." };
  // With maker-checker off, the refund is approved immediately (no separate approval step).
  const autoApprove = !c.requireApproval;
  try {
    await db.transaction(async (tx) => {
      // Serialize all refund activity for this student so two concurrent requests can't both spend the
      // same credit. The auto-approve path inserts 'approved' directly, so a pending-row check alone
      // wouldn't prevent a double payout — we re-derive the credit under the lock and re-check.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.studentId})::bigint)`);
      const [billed] = await tx.select({ t: sql<string>`coalesce(sum(${invoices.amount}),0)` }).from(invoices).where(and(eq(invoices.studentId, input.studentId), eq(invoices.schoolId, c.schoolId)));
      const [paid] = await tx.select({ t: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(payments).where(and(eq(payments.studentId, input.studentId), eq(payments.schoolId, c.schoolId), eq(payments.status, "approved")));
      const [refunded] = await tx.select({ t: sql<string>`coalesce(sum(${refundRequests.amount}),0)` }).from(refundRequests).where(and(eq(refundRequests.studentId, input.studentId), eq(refundRequests.schoolId, c.schoolId), eq(refundRequests.status, "approved")));
      const credit = Math.max(0, Number(paid.t) - Number(billed.t) - Number(refunded.t));
      if (input.amount > credit) throw new RefundError(`Refund can't exceed the credit balance of ₦${credit.toLocaleString()}.`);
      const [open] = await tx.select({ id: refundRequests.id }).from(refundRequests).where(and(eq(refundRequests.studentId, input.studentId), eq(refundRequests.status, "pending"))).limit(1);
      if (open) throw new RefundError("There's already a pending refund request for this student.");
      await tx.insert(refundRequests).values({ schoolId: c.schoolId, studentId: input.studentId, amount: input.amount.toFixed(2), reason: input.reason?.trim() || null, status: autoApprove ? "approved" : "pending", requestedByUserId: c.userId, ...(autoApprove ? { approvedByUserId: c.userId, decidedAt: new Date() } : {}) });
    });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: autoApprove ? "refund.approved" : "refund.requested", entityType: "Finance", entityId: input.studentId, metadata: { amount: input.amount, student: await studentName(input.studentId) } });
    return { ok: true, approved: autoApprove };
  } catch (e) {
    if (e instanceof RefundError) return { error: e.message };
    return { error: "Could not submit the refund request. Please try again." };
  }
}

export async function decideRefund(id: string, approve: boolean, reason?: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canApprove) return { error: "You don't have approval rights." };
  const [r] = await db.select().from(refundRequests).where(and(eq(refundRequests.id, id), eq(refundRequests.schoolId, c.schoolId))).limit(1);
  if (!r) return { error: "Refund request not found." };
  if (r.status !== "pending") return { error: "This request was already decided." };
  // Maker-checker only when the school requires it (consistent with payment approvals).
  if (approve && c.requireApproval && r.requestedByUserId === c.userId) return { error: "Maker-checker is on: a different staff member must approve the refund." };
  try {
    await db.update(refundRequests).set({ status: approve ? "approved" : "rejected", approvedByUserId: c.userId, decidedAt: new Date(), reason: reason?.trim() || r.reason, updatedAt: new Date() }).where(eq(refundRequests.id, id));
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: approve ? "refund.approved" : "refund.rejected", entityType: "Finance", entityId: r.studentId, metadata: { amount: Number(r.amount), student: await studentName(r.studentId) } });
    return { ok: true };
  } catch {
    return { error: "Could not process the decision." };
  }
}
