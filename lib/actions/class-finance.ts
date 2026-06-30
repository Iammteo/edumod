"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/context";
import { invoices, payments, students } from "@/db/schema";

async function ctx() {
  const a = await getAuthContext();
  if (!a) return null;
  const canView = ["school_admin", "secretary", "principal", "vice_principal"].includes(a.role);
  return { userId: a.userId, schoolId: a.schoolId, canView };
}

function levelOf(cn: string) { const c = cn.toLowerCase(); if (c.startsWith("primary")) return "Primary"; if (c.startsWith("jss")) return "JSS"; if (c.startsWith("ss")) return "SSS"; return "Other"; }
function dueStatus(rate: number, outstanding: number): "cleared" | "follow_up" | "at_risk" {
  if (outstanding <= 0) return "cleared";
  return rate < 60 ? "at_risk" : "follow_up";
}

export type ClassRow = { className: string; level: string; students: number; expected: number; collected: number; outstanding: number; rate: number; status: "cleared" | "follow_up" | "at_risk"; lastPayment: string | null };
export type ClassFinance = {
  totals: { expected: number; collected: number; outstanding: number; rate: number; classesWithBalance: number; totalClasses: number; overpaidCredit: number; overpaidCount: number };
  classes: ClassRow[];
};

export async function getClassFinance(): Promise<ClassFinance | { error: string }> {
  const c = await ctx();
  if (!c?.canView) return { error: "Not authorised." };
  const [invByClass, paidByClass, countByClass, lastByClass, invByStu, paidByStu] = await Promise.all([
    db.select({ cn: students.className, total: sql<string>`coalesce(sum(${invoices.amount}),0)` }).from(invoices).innerJoin(students, eq(students.id, invoices.studentId)).where(and(eq(invoices.schoolId, c.schoolId), eq(invoices.mandatory, true))).groupBy(students.className),
    db.select({ cn: students.className, total: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(payments).innerJoin(students, eq(students.id, payments.studentId)).where(and(eq(payments.schoolId, c.schoolId), eq(payments.status, "approved"))).groupBy(students.className),
    db.select({ cn: students.className, count: sql<number>`count(*)::int` }).from(students).where(eq(students.schoolId, c.schoolId)).groupBy(students.className),
    db.select({ cn: students.className, last: sql<string>`max(${payments.createdAt})` }).from(payments).innerJoin(students, eq(students.id, payments.studentId)).where(and(eq(payments.schoolId, c.schoolId), eq(payments.status, "approved"))).groupBy(students.className),
    db.select({ sid: invoices.studentId, total: sql<string>`coalesce(sum(${invoices.amount}),0)` }).from(invoices).where(and(eq(invoices.schoolId, c.schoolId), eq(invoices.mandatory, true))).groupBy(invoices.studentId),
    db.select({ sid: payments.studentId, total: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(payments).where(and(eq(payments.schoolId, c.schoolId), eq(payments.status, "approved"))).groupBy(payments.studentId),
  ]);
  const key = (cn: string | null) => cn || "Unassigned";
  const expected = new Map<string, number>(), collected = new Map<string, number>(), count = new Map<string, number>(), last = new Map<string, string>();
  for (const r of invByClass) expected.set(key(r.cn), Number(r.total));
  for (const r of paidByClass) collected.set(key(r.cn), Number(r.total));
  for (const r of countByClass) count.set(key(r.cn), Number(r.count));
  for (const r of lastByClass) if (r.last) last.set(key(r.cn), new Date(r.last).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }));

  const names = new Set<string>([...expected.keys(), ...collected.keys()]);
  const classes: ClassRow[] = [...names].map((cn) => {
    const exp = expected.get(cn) ?? 0, col = collected.get(cn) ?? 0;
    const out = Math.max(0, exp - col);
    const rate = exp > 0 ? Math.round((col / exp) * 1000) / 10 : 0;
    return { className: cn, level: levelOf(cn), students: count.get(cn) ?? 0, expected: exp, collected: col, outstanding: out, rate, status: dueStatus(rate, out), lastPayment: last.get(cn) ?? null };
  }).filter((c) => c.expected > 0 || c.collected > 0).sort((a, b) => b.outstanding - a.outstanding);

  const tExp = classes.reduce((n, c) => n + c.expected, 0), tCol = classes.reduce((n, c) => n + c.collected, 0);
  // Overpaid credit: per-student, sum of (paid − billed) where positive.
  const invS = new Map(invByStu.map((r) => [r.sid, Number(r.total)]));
  let overpaidCredit = 0, overpaidCount = 0;
  for (const r of paidByStu) { const over = Number(r.total) - (invS.get(r.sid) ?? 0); if (over > 0) { overpaidCredit += over; overpaidCount += 1; } }
  return {
    totals: { expected: tExp, collected: tCol, outstanding: Math.max(0, tExp - tCol), rate: tExp > 0 ? Math.round((tCol / tExp) * 1000) / 10 : 0, classesWithBalance: classes.filter((c) => c.outstanding > 0).length, totalClasses: classes.length, overpaidCredit, overpaidCount },
    classes,
  };
}

export type ClassFeeItem = { description: string; amount: number; mandatory: boolean };
export type ClassStudentRow = { id: string; name: string; guardian: string; guardianPhone: string; paid: number; outstanding: number; status: "cleared" | "partial" | "unpaid"; lastPayment: string | null };
export type ClassDetail = {
  className: string; students: number; expected: number; collected: number; outstanding: number;
  feeItems: ClassFeeItem[];
  studentRows: ClassStudentRow[];
};

export type OutstandingStudent = { className: string; student: string; guardian: string; phone: string; paid: number; outstanding: number; status: string };
// Every student in the school with an unpaid balance, with parent contact - for exported reports.
export async function getOutstandingStudents(): Promise<OutstandingStudent[] | { error: string }> {
  const c = await ctx();
  if (!c?.canView) return { error: "Not authorised." };
  const studs = await db.select({ id: students.id, fn: students.firstName, ln: students.lastName, cn: students.className, profile: students.profile }).from(students).where(eq(students.schoolId, c.schoolId));
  const ids = studs.map((s) => s.id);
  if (ids.length === 0) return [];
  const [invByStu, paidByStu] = await Promise.all([
    db.select({ sid: invoices.studentId, total: sql<string>`coalesce(sum(${invoices.amount}),0)` }).from(invoices).where(and(inArray(invoices.studentId, ids), eq(invoices.mandatory, true))).groupBy(invoices.studentId),
    db.select({ sid: payments.studentId, total: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(payments).where(and(inArray(payments.studentId, ids), eq(payments.status, "approved"))).groupBy(payments.studentId),
  ]);
  const inv = new Map(invByStu.map((r) => [r.sid, Number(r.total)])), paid = new Map(paidByStu.map((r) => [r.sid, Number(r.total)]));
  return studs.map((st) => {
    const billed = inv.get(st.id) ?? 0, p = paid.get(st.id) ?? 0, out = Math.max(0, billed - p);
    const pr = (st.profile && typeof st.profile === "object" ? st.profile : {}) as Record<string, unknown>;
    const g = (pr.guardian1 && typeof pr.guardian1 === "object" ? pr.guardian1 : {}) as Record<string, unknown>;
    return { className: st.cn || "Unassigned", student: `${st.fn} ${st.ln}`.trim(), guardian: typeof g.name === "string" ? g.name : "", phone: typeof g.phone === "string" ? g.phone : "", paid: p, outstanding: out, status: billed > 0 && out <= 0 ? "Cleared" : p > 0 ? "Partial" : "Unpaid" };
  }).filter((r) => r.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
}

export async function getClassDetail(className: string): Promise<ClassDetail | { error: string }> {
  const c = await ctx();
  if (!c?.canView) return { error: "Not authorised." };
  const cn = className === "Unassigned" ? null : className;
  const where = cn ? and(eq(students.schoolId, c.schoolId), eq(students.className, cn)) : and(eq(students.schoolId, c.schoolId), sql`${students.className} is null`);
  const studs = await db.select({ id: students.id, fn: students.firstName, ln: students.lastName, profile: students.profile }).from(students).where(where).orderBy(students.firstName);
  const ids = studs.map((s) => s.id);
  if (ids.length === 0) return { className, students: 0, expected: 0, collected: 0, outstanding: 0, feeItems: [], studentRows: [] };

  const [invByStu, paidByStu, lastByStu, feeRows] = await Promise.all([
    db.select({ sid: invoices.studentId, total: sql<string>`coalesce(sum(${invoices.amount}),0)` }).from(invoices).where(and(inArray(invoices.studentId, ids), eq(invoices.mandatory, true))).groupBy(invoices.studentId),
    db.select({ sid: payments.studentId, total: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(payments).where(and(inArray(payments.studentId, ids), eq(payments.status, "approved"))).groupBy(payments.studentId),
    db.select({ sid: payments.studentId, last: sql<string>`max(${payments.createdAt})` }).from(payments).where(and(inArray(payments.studentId, ids), eq(payments.status, "approved"))).groupBy(payments.studentId),
    db.select({ description: invoices.description, mandatory: invoices.mandatory, total: sql<string>`coalesce(sum(${invoices.amount}),0)` }).from(invoices).where(inArray(invoices.studentId, ids)).groupBy(invoices.description, invoices.mandatory),
  ]);
  const invMap = new Map(invByStu.map((r) => [r.sid, Number(r.total)]));
  const paidMap = new Map(paidByStu.map((r) => [r.sid, Number(r.total)]));
  const lastMap = new Map(lastByStu.filter((r) => r.last).map((r) => [r.sid, new Date(r.last).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })]));

  let expected = 0, collected = 0;
  const studentRows: ClassStudentRow[] = studs.map((st) => {
    const inv = invMap.get(st.id) ?? 0, paid = paidMap.get(st.id) ?? 0;
    expected += inv; collected += paid;
    const out = Math.max(0, inv - paid);
    const status: "cleared" | "partial" | "unpaid" = inv > 0 && out <= 0 ? "cleared" : paid > 0 ? "partial" : "unpaid";
    const p = (st.profile && typeof st.profile === "object" ? st.profile : {}) as Record<string, unknown>;
    const g = (p.guardian1 && typeof p.guardian1 === "object" ? p.guardian1 : {}) as Record<string, unknown>;
    return { id: st.id, name: `${st.fn} ${st.ln}`.trim(), guardian: typeof g.name === "string" ? g.name : "", guardianPhone: typeof g.phone === "string" ? g.phone : "", paid, outstanding: out, status, lastPayment: lastMap.get(st.id) ?? null };
  }).sort((a, b) => b.outstanding - a.outstanding);

  return {
    className, students: studs.length, expected, collected, outstanding: Math.max(0, expected - collected),
    feeItems: feeRows.map((r) => ({ description: r.description || "School fees", amount: Number(r.total), mandatory: r.mandatory })).sort((a, b) => b.amount - a.amount),
    studentRows,
  };
}
