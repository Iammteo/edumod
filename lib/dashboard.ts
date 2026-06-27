// Server-side data helpers for the role dashboards. Plain async functions called from the
// dashboard server component — they read real data so the dashboards stop showing mock numbers.
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, payments, students, studentResults } from "@/db/schema";
import { gradeFor } from "@/lib/grading";

function classify(className: string | null) {
  const c = (className || "").toLowerCase();
  if (c.startsWith("primary")) return "primary";
  if (c.startsWith("jss")) return "jss";
  if (c.startsWith("ss")) return "sss";
  return "other";
}

export type AdminOverview = {
  collected: number;
  outstanding: number;
  sections: { jss: number; sss: number; primary: number; other: number };
  series: { label: string; value: number }[];
};

export async function adminOverview(schoolId: string): Promise<AdminOverview> {
  const now = new Date();
  const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [collectedRow, invoiceRows, paidRows, classRows, seriesRows] = await Promise.all([
    db.select({ total: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(payments).where(and(eq(payments.schoolId, schoolId), eq(payments.status, "approved"))),
    db.select({ id: invoices.id, amount: invoices.amount }).from(invoices).where(eq(invoices.schoolId, schoolId)),
    db.select({ invoiceId: payments.invoiceId, paid: sql<string>`sum(${payments.amount})` }).from(payments).where(and(eq(payments.schoolId, schoolId), eq(payments.status, "approved"))).groupBy(payments.invoiceId),
    db.select({ className: students.className, count: sql<number>`count(*)::int` }).from(students).where(eq(students.schoolId, schoolId)).groupBy(students.className),
    db.select({ m: sql<string>`to_char(date_trunc('month', ${payments.createdAt}), 'YYYY-MM')`, total: sql<string>`sum(${payments.amount})` }).from(payments).where(and(eq(payments.schoolId, schoolId), eq(payments.status, "approved"), gte(payments.createdAt, sixAgo))).groupBy(sql`date_trunc('month', ${payments.createdAt})`),
  ]);

  const collected = Number(collectedRow[0]?.total ?? 0);
  const paidMap = new Map<string, number>();
  for (const p of paidRows) if (p.invoiceId) paidMap.set(p.invoiceId, Number(p.paid));
  let outstanding = 0;
  for (const inv of invoiceRows) outstanding += Math.max(0, Number(inv.amount) - (paidMap.get(inv.id) ?? 0));

  const sections = { jss: 0, sss: 0, primary: 0, other: 0 };
  for (const r of classRows) sections[classify(r.className)] += Number(r.count);

  // Fixed 6-month skeleton so empty months still render as 0.
  const seriesMap = new Map(seriesRows.map((r) => [r.m, Number(r.total)]));
  const series: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    series.push({ label: d.toLocaleString("en", { month: "short" }), value: seriesMap.get(key) ?? 0 });
  }
  return { collected, outstanding, sections, series };
}

export type StudentFee = { id: string; name: string; status: string; amount: number; outstanding: number; date: string };
export type StudentTermResult = { term: string; subjects: { subject: string; ca: number; exam: number; total: number; grade: string }[]; average: number; grade: string; remark: string };
export type StudentOverview = {
  admissionNo: string;
  className: string | null;
  outstanding: number;
  paid: number;
  fees: StudentFee[];
  results: StudentTermResult[];
} | null;

export async function studentOverview(userId: string): Promise<StudentOverview> {
  const [stu] = await db.select().from(students).where(eq(students.userId, userId)).limit(1);
  if (!stu) return null;
  const [invRows, paidRows, paidTotalRow, resultRows] = await Promise.all([
    db.select({ id: invoices.id, description: invoices.description, amount: invoices.amount, createdAt: invoices.createdAt }).from(invoices).where(eq(invoices.studentId, stu.id)).orderBy(desc(invoices.createdAt)).limit(20),
    db.select({ invoiceId: payments.invoiceId, paid: sql<string>`sum(${payments.amount})` }).from(payments).where(and(eq(payments.studentId, stu.id), eq(payments.status, "approved"))).groupBy(payments.invoiceId),
    db.select({ total: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(payments).where(and(eq(payments.studentId, stu.id), eq(payments.status, "approved"))),
    db.select().from(studentResults).where(eq(studentResults.studentId, stu.id)).orderBy(asc(studentResults.term), asc(studentResults.subject)),
  ]);
  const paidMap = new Map<string, number>();
  for (const p of paidRows) if (p.invoiceId) paidMap.set(p.invoiceId, Number(p.paid));
  let outstanding = 0;
  const fees: StudentFee[] = invRows.map((inv) => {
    const amount = Number(inv.amount);
    const paid = paidMap.get(inv.id) ?? 0;
    const due = Math.max(0, amount - paid);
    outstanding += due;
    const status = paid <= 0 ? "outstanding" : paid >= amount ? "paid" : "partially_paid";
    return { id: inv.id, name: inv.description || "School fees", status, amount, outstanding: due, date: new Date(inv.createdAt).toLocaleDateString() };
  });
  const byTerm = new Map<string, { subject: string; ca: number; exam: number; total: number; grade: string }[]>();
  for (const r of resultRows) {
    const total = r.ca + r.exam;
    const list = byTerm.get(r.term) ?? [];
    list.push({ subject: r.subject, ca: r.ca, exam: r.exam, total, grade: gradeFor(total).grade });
    byTerm.set(r.term, list);
  }
  const results: StudentTermResult[] = [...byTerm.entries()].map(([term, subjects]) => {
    const avg = subjects.length ? Math.round((subjects.reduce((n, s) => n + s.total, 0) / subjects.length) * 10) / 10 : 0;
    const { grade, remark } = gradeFor(avg);
    return { term, subjects, average: avg, grade, remark };
  }).sort((a, b) => b.term.localeCompare(a.term));

  return { admissionNo: stu.admissionNo, className: stu.className, outstanding, paid: Number(paidTotalRow[0]?.total ?? 0), fees, results };
}
