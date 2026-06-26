"use server";

import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, payments, students, users } from "@/db/schema";

async function ctx() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (!m) return null;
  return { userId: session.user.id, schoolId: m.schoolId, role: m.role, canApprove: m.role === "school_admin" || m.canApprovePayments };
}

export type Payment = { id: string; student: string; admissionNo: string; amount: number; method: string; status: string; recordedBy: string; mine: boolean; date: string; description: string | null };
export type FinanceData = {
  stats: { collected: number; pending: number; pendingCount: number; thisMonth: number };
  payments: Payment[];
  students: { id: string; name: string; admissionNo: string }[];
  canRecord: boolean;
  canApprove: boolean;
};

export async function getFinanceData(): Promise<FinanceData | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  const [rows, studentRows] = await Promise.all([
    db.select({ id: payments.id, amount: payments.amount, method: payments.method, status: payments.status, description: payments.description, createdAt: payments.createdAt, recordedByUserId: payments.recordedByUserId, sf: students.firstName, sl: students.lastName, admissionNo: students.admissionNo, recordedBy: users.name })
      .from(payments).innerJoin(students, eq(students.id, payments.studentId)).leftJoin(users, eq(users.id, payments.recordedByUserId))
      .where(eq(payments.schoolId, c.schoolId)).orderBy(desc(payments.createdAt)).limit(100),
    db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName, admissionNo: students.admissionNo }).from(students).where(eq(students.schoolId, c.schoolId)).orderBy(desc(students.createdAt)).limit(300),
  ]);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let collected = 0, pending = 0, pendingCount = 0, thisMonth = 0;
  const list: Payment[] = rows.map((r) => {
    const amt = Number(r.amount);
    if (r.status === "approved") { collected += amt; if (new Date(r.createdAt) >= monthStart) thisMonth += amt; }
    if (r.status === "pending_approval") { pending += amt; pendingCount += 1; }
    return { id: r.id, student: `${r.sf} ${r.sl}`.trim(), admissionNo: r.admissionNo, amount: amt, method: r.method, status: r.status, recordedBy: r.recordedBy ?? "—", mine: r.recordedByUserId === c.userId, date: new Date(r.createdAt).toLocaleDateString(), description: r.description };
  });
  return { stats: { collected, pending, pendingCount, thisMonth }, payments: list, students: studentRows.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`.trim(), admissionNo: s.admissionNo })), canRecord: c.role === "school_admin" || c.role === "bursar", canApprove: c.canApprove };
}

export async function recordPayment(input: { studentId: string; amount: number; method: string; description?: string }): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (c.role !== "school_admin" && c.role !== "bursar") return { error: "You don't have permission to record payments." };
  if (!input.studentId) return { error: "Please select a student." };
  if (!(input.amount > 0)) return { error: "Enter a valid amount." };
  try {
    await db.insert(payments).values({ schoolId: c.schoolId, studentId: input.studentId, amount: input.amount.toFixed(2), method: input.method === "transfer" ? "transfer" : "cash", status: "pending_approval", description: input.description?.trim() || null, recordedByUserId: c.userId });
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
  if (p.recordedByUserId === c.userId) return { error: "You can't approve a payment you recorded (maker-checker)." };
  try {
    await db.update(payments).set({ status: "approved", approvedByUserId: c.userId, approvedAt: new Date(), updatedAt: new Date() }).where(eq(payments.id, id));
    return { ok: true };
  } catch {
    return { error: "Could not approve — the approver must differ from the recorder." };
  }
}

export async function rejectPayment(id: string, reason: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canApprove) return { error: "You don't have approval rights." };
  const [p] = await db.select().from(payments).where(and(eq(payments.id, id), eq(payments.schoolId, c.schoolId))).limit(1);
  if (!p || p.status !== "pending_approval") return { error: "This payment was already processed." };
  try {
    await db.update(payments).set({ status: "rejected", rejectedReason: reason.trim() || "Rejected", updatedAt: new Date() }).where(eq(payments.id, id));
    return { ok: true };
  } catch {
    return { error: "Could not reject the payment." };
  }
}
