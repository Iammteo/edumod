"use server";

import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices, memberships, payments, refundRequests, students } from "@/db/schema";
import { logAudit } from "@/lib/audit";

async function ctx() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (!m) return null;
  return { userId: session.user.id, schoolId: m.schoolId, role: m.role, canManage: m.role === "school_admin" || m.role === "bursar", canApprove: m.role === "school_admin" || m.canApprovePayments };
}

// Credit = approved payments − amount billed − refunds already approved. Positive means overpaid.
export async function creditBalance(studentId: string, schoolId: string): Promise<number> {
  const [inv] = await db.select({ t: sql<string>`coalesce(sum(${invoices.amount}),0)` }).from(invoices).where(eq(invoices.studentId, studentId));
  const [pay] = await db.select({ t: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(payments).where(and(eq(payments.studentId, studentId), eq(payments.status, "approved")));
  const [ref] = await db.select({ t: sql<string>`coalesce(sum(${refundRequests.amount}),0)` }).from(refundRequests).where(and(eq(refundRequests.studentId, studentId), eq(refundRequests.status, "approved")));
  return Math.max(0, Number(pay.t) - Number(inv.t) - Number(ref.t));
}

async function studentName(studentId: string) {
  const [s] = await db.select({ fn: students.firstName, ln: students.lastName }).from(students).where(eq(students.id, studentId)).limit(1);
  return s ? `${s.fn} ${s.ln}`.trim() : "student";
}

export async function carryForwardCredit(studentId: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission." };
  const credit = await creditBalance(studentId, c.schoolId);
  if (credit <= 0) return { error: "This student has no credit to carry forward." };
  await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "credit.carried_forward", entityType: "Finance", entityId: studentId, metadata: { amount: credit, student: await studentName(studentId) } });
  return { ok: true };
}

export async function requestRefund(input: { studentId: string; amount: number; reason?: string }): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to request a refund." };
  const [stu] = await db.select({ id: students.id }).from(students).where(and(eq(students.id, input.studentId), eq(students.schoolId, c.schoolId))).limit(1);
  if (!stu) return { error: "Student not found." };
  const credit = await creditBalance(input.studentId, c.schoolId);
  if (!(input.amount > 0)) return { error: "Enter a valid refund amount." };
  if (input.amount > credit) return { error: `Refund can't exceed the credit balance of ₦${credit.toLocaleString()}.` };
  const [open] = await db.select({ id: refundRequests.id }).from(refundRequests).where(and(eq(refundRequests.studentId, input.studentId), eq(refundRequests.status, "pending"))).limit(1);
  if (open) return { error: "There's already a pending refund request for this student." };
  try {
    await db.insert(refundRequests).values({ schoolId: c.schoolId, studentId: input.studentId, amount: input.amount.toFixed(2), reason: input.reason?.trim() || null, status: "pending", requestedByUserId: c.userId });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "refund.requested", entityType: "Finance", entityId: input.studentId, metadata: { amount: input.amount, student: await studentName(input.studentId) } });
    return { ok: true };
  } catch {
    return { error: "Could not submit the refund request. Please try again." };
  }
}

export async function decideRefund(id: string, approve: boolean, reason?: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canApprove) return { error: "You don't have approval rights." };
  const [r] = await db.select().from(refundRequests).where(and(eq(refundRequests.id, id), eq(refundRequests.schoolId, c.schoolId))).limit(1);
  if (!r) return { error: "Refund request not found." };
  if (r.status !== "pending") return { error: "This request was already decided." };
  if (approve && r.requestedByUserId === c.userId) return { error: "A different staff member must approve the refund (maker-checker)." };
  try {
    await db.update(refundRequests).set({ status: approve ? "approved" : "rejected", approvedByUserId: c.userId, decidedAt: new Date(), reason: reason?.trim() || r.reason, updatedAt: new Date() }).where(eq(refundRequests.id, id));
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: approve ? "refund.approved" : "refund.rejected", entityType: "Finance", entityId: r.studentId, metadata: { amount: Number(r.amount), student: await studentName(r.studentId) } });
    return { ok: true };
  } catch {
    return { error: "Could not process the decision." };
  }
}
