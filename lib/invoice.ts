import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { feeStructures, invoices, payments, students } from "@/db/schema";

// A single billed item on an invoice (e.g. Tuition, PTA). When a bill is issued with several items
// each becomes its own invoice row sharing a feeStructureId - we re-group them into one document.
export type InvoiceLine = { id: string; description: string; amount: number; mandatory: boolean; paid: number; outstanding: number };
export type InvoiceBill = {
  id: string;
  no: string;
  billName: string | null;
  termLabel: string | null;
  createdAt: Date;
  dueDate: string | null;
  studentName: string;
  admissionNo: string;
  className: string | null;
  lines: InvoiceLine[];
  total: number;
  paid: number;
  outstanding: number;
  hasBreakdown: boolean;
};

// Cap on how many bills a single filtered export will resolve, to keep the page responsive.
export const EXPORT_CAP = 200;

const invNo = (id: string) => `INV-${id.slice(0, 8).toUpperCase()}`;

// Payment status of a whole bill, derived from its totals.
export function billStatus(b: InvoiceBill): "paid" | "partially_paid" | "outstanding" {
  if (b.outstanding <= 0) return "paid";
  if (b.paid > 0) return "partially_paid";
  return "outstanding";
}

// One invoice row joined with its student and (optional) fee structure.
type BillRow = { id: string; feeStructureId: string | null; studentId: string; description: string | null; amount: string; mandatory: boolean; dueDate: string | null; createdAt: Date; sf: string; sl: string; admissionNo: string; className: string | null; feeName: string | null; termLabel: string | null };
const BILL_COLS = { id: invoices.id, feeStructureId: invoices.feeStructureId, studentId: invoices.studentId, description: invoices.description, amount: invoices.amount, mandatory: invoices.mandatory, dueDate: invoices.dueDate, createdAt: invoices.createdAt, sf: students.firstName, sl: students.lastName, admissionNo: students.admissionNo, className: students.className, feeName: feeStructures.name, termLabel: feeStructures.termLabel };

// Approved-payment totals for a set of invoice ids, keyed by invoice id.
async function paidByInvoice(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select({ invoiceId: payments.invoiceId, paid: sql<string>`coalesce(sum(${payments.amount}),0)` })
    .from(payments).where(and(inArray(payments.invoiceId, ids), eq(payments.status, "approved"))).groupBy(payments.invoiceId);
  return new Map(rows.map((r) => [r.invoiceId as string, Number(r.paid)]));
}

// Group invoice rows into bills (one per student + fee structure) and compute their line items and
// balances from a precomputed paid-per-invoice map. All siblings of a bill share a student and fee
// structure, so any class/term filter keeps a bill's items together.
function buildBills(rows: BillRow[], paidMap: Map<string, number>): InvoiceBill[] {
  const groups = new Map<string, BillRow[]>();
  for (const r of rows) {
    const key = `${r.studentId}:${r.feeStructureId ?? r.id}`;
    const arr = groups.get(key);
    if (arr) arr.push(r); else groups.set(key, [r]);
  }
  const bills: InvoiceBill[] = [];
  for (const arr of groups.values()) {
    const head = arr[0];
    const lines: InvoiceLine[] = arr.map((s) => {
      const amount = Number(s.amount);
      const paid = paidMap.get(s.id) ?? 0;
      return { id: s.id, description: s.description || "School fees", amount, mandatory: s.mandatory, paid, outstanding: Math.max(0, amount - paid) };
    });
    const total = lines.reduce((n, l) => n + l.amount, 0);
    const paid = lines.reduce((n, l) => n + l.paid, 0);
    bills.push({ id: head.id, no: invNo(head.id), billName: head.feeName, termLabel: head.termLabel, createdAt: head.createdAt, dueDate: head.dueDate, studentName: `${head.sf} ${head.sl}`.trim(), admissionNo: head.admissionNo, className: head.className, lines, total, paid, outstanding: Math.max(0, total - paid), hasBreakdown: lines.length > 1 });
  }
  return bills;
}

const billQuery = () => db.select(BILL_COLS).from(invoices).innerJoin(students, eq(students.id, invoices.studentId)).leftJoin(feeStructures, eq(feeStructures.id, invoices.feeStructureId));

// Load one invoice as a full bill document. If the invoice belongs to a fee structure, all of that
// student's sibling line items from the same bill are included so the breakdown shows.
export async function loadInvoiceBill(invoiceId: string, schoolId: string): Promise<InvoiceBill | null> {
  const [target] = await db.select({ feeStructureId: invoices.feeStructureId, studentId: invoices.studentId }).from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.schoolId, schoolId))).limit(1);
  if (!target) return null;
  const where = target.feeStructureId
    ? and(eq(invoices.schoolId, schoolId), eq(invoices.studentId, target.studentId), eq(invoices.feeStructureId, target.feeStructureId))
    : and(eq(invoices.schoolId, schoolId), eq(invoices.id, invoiceId));
  const rows = (await billQuery().where(where).orderBy(asc(invoices.createdAt))) as BillRow[];
  if (rows.length === 0) return null;
  const paidMap = await paidByInvoice(rows.map((r) => r.id));
  return buildBills(rows, paidMap)[0] ?? null;
}

// Load several specific invoices as bills, de-duplicating line items that belong to the same bill
// for the same student (so selecting three items of one bill yields one document, not three).
export async function loadInvoiceBills(ids: string[], schoolId: string): Promise<InvoiceBill[]> {
  if (ids.length === 0) return [];
  // Find the distinct bills the selected ids belong to, preserving the order they were passed.
  const keyRows = await db.select({ id: invoices.id, feeStructureId: invoices.feeStructureId, studentId: invoices.studentId }).from(invoices).where(and(inArray(invoices.id, ids), eq(invoices.schoolId, schoolId)));
  const byId = new Map(keyRows.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const reps: string[] = [];
  for (const id of ids) {
    const r = byId.get(id);
    if (!r) continue;
    const key = `${r.studentId}:${r.feeStructureId ?? r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    reps.push(r.id);
  }
  const bills = await Promise.all(reps.map((id) => loadInvoiceBill(id, schoolId)));
  return bills.filter((b): b is InvoiceBill => b !== null);
}

// Load bills matching a class / term / status filter (for the Reports & exports section). One query
// for rows, one for payments - no N+1. Returns the (capped) bills plus the total number matched.
export async function loadInvoiceBillsByFilter(schoolId: string, filter: { className?: string; termLabel?: string; status?: string }): Promise<{ bills: InvoiceBill[]; matched: number }> {
  const conds = [eq(invoices.schoolId, schoolId)];
  if (filter.className) conds.push(eq(students.className, filter.className));
  if (filter.termLabel) conds.push(eq(feeStructures.termLabel, filter.termLabel));
  const rows = (await billQuery().where(and(...conds)).orderBy(asc(invoices.createdAt))) as BillRow[];
  const paidMap = await paidByInvoice(rows.map((r) => r.id));
  let bills = buildBills(rows, paidMap);
  if (filter.status) bills = bills.filter((b) => billStatus(b) === filter.status);
  return { bills: bills.slice(0, EXPORT_CAP), matched: bills.length };
}
