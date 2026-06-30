import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { feeStructures, invoices, payments, students } from "@/db/schema";

// Balance on the invoice a payment was applied to (for partial-payment receipts). Null when the
// payment wasn't tied to a specific invoice.
export async function invoiceBalance(invoiceId: string | null | undefined): Promise<{ total: number | null; paid: number | null; outstanding: number | null }> {
  if (!invoiceId) return { total: null, paid: null, outstanding: null };
  const [inv] = await db.select({ amount: invoices.amount }).from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!inv) return { total: null, paid: null, outstanding: null };
  const [{ paid }] = await db.select({ paid: sql<string>`coalesce(sum(${payments.amount}),0)` }).from(payments).where(and(eq(payments.invoiceId, invoiceId), eq(payments.status, "approved")));
  const total = Number(inv.amount), p = Number(paid);
  return { total, paid: p, outstanding: Math.max(0, total - p) };
}

// ---------------------------------------------------------------------------- Receipt reports
export const RECEIPT_EXPORT_CAP = 200;
export type ReceiptFilter = { className?: string; termLabel?: string; from?: string; to?: string };
export type ReceiptReportRow = { id: string; studentId: string; no: string; student: string; className: string | null; method: string; amount: number; date: string; token: string | null };
const rcpNo = (id: string) => `RCP-${id.slice(0, 8).toUpperCase()}`;

// Receipts (approved payments) are joined to their invoice's fee structure so they can be filtered
// by term; a term filter therefore excludes general payments that aren't tied to an invoice.
function receiptConds(schoolId: string, f: ReceiptFilter) {
  const c = [eq(payments.schoolId, schoolId), eq(payments.status, "approved")];
  if (f.className) c.push(eq(students.className, f.className));
  if (f.termLabel) c.push(eq(feeStructures.termLabel, f.termLabel));
  if (f.from) c.push(gte(payments.createdAt, new Date(f.from)));
  if (f.to) c.push(lte(payments.createdAt, new Date(`${f.to}T23:59:59.999`)));
  return c;
}
export async function loadReceiptReport(schoolId: string, f: ReceiptFilter): Promise<{ rows: ReceiptReportRow[]; matched: number }> {
  const rows = await db.select({ id: payments.id, sid: students.id, amount: payments.amount, method: payments.method, createdAt: payments.createdAt, receiptKey: payments.receiptKey, sf: students.firstName, sl: students.lastName, className: students.className })
    .from(payments)
    .innerJoin(students, eq(students.id, payments.studentId))
    .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
    .leftJoin(feeStructures, eq(feeStructures.id, invoices.feeStructureId))
    .where(and(...receiptConds(schoolId, f))).orderBy(desc(payments.createdAt));
  const mapped: ReceiptReportRow[] = rows.map((r) => ({ id: r.id, studentId: r.sid, no: rcpNo(r.id), student: `${r.sf} ${r.sl}`.trim(), className: r.className, method: r.method, amount: Number(r.amount), date: new Date(r.createdAt).toLocaleDateString(), token: r.receiptKey }));
  return { rows: mapped.slice(0, RECEIPT_EXPORT_CAP), matched: mapped.length };
}

export async function receiptIdsByFilter(schoolId: string, f: ReceiptFilter): Promise<string[]> {
  const rows = await db.select({ id: payments.id })
    .from(payments)
    .innerJoin(students, eq(students.id, payments.studentId))
    .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
    .leftJoin(feeStructures, eq(feeStructures.id, invoices.feeStructureId))
    .where(and(...receiptConds(schoolId, f))).orderBy(desc(payments.createdAt)).limit(RECEIPT_EXPORT_CAP);
  return rows.map((r) => r.id);
}
