import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, payments, schools, students, users } from "@/db/schema";
import { ReceiptDoc } from "@/components/app/receipt-card";
import { ReceiptActions } from "@/components/app/receipt-actions";
import { invoiceBalance, receiptIdsByFilter } from "@/lib/receipt";

// Batch receipt view — print/download several receipts at once. Either an explicit selection
// (?ids=a,b,c) or a Reports filter (?class=&term=&from=&to=) when exporting a whole set.
export default async function ReceiptBatchPage({ searchParams }: { searchParams: Promise<{ ids?: string; class?: string; term?: string; from?: string; to?: string; report?: string }> }) {
  const sp = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (!m) redirect("/dashboard");

  const empty = <div className="grid min-h-screen place-items-center text-[14px] text-ink-soft">No receipts selected.</div>;
  let idList = (sp.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (idList.length === 0 && (sp.class || sp.term || sp.from || sp.to || sp.report)) {
    idList = await receiptIdsByFilter(m.schoolId, { className: sp.class, termLabel: sp.term, from: sp.from, to: sp.to });
  }
  if (idList.length === 0) return empty;

  const recorder = users, approver = alias(users, "approver");
  const rows = await db.select({ id: payments.id, amount: payments.amount, method: payments.method, status: payments.status, description: payments.description, createdAt: payments.createdAt, approvedAt: payments.approvedAt, proofKey: payments.proofKey, receiptKey: payments.receiptKey, invoiceId: payments.invoiceId, sf: students.firstName, sl: students.lastName, admissionNo: students.admissionNo, className: students.className, recordedBy: recorder.name, approvedBy: approver.name })
    .from(payments).innerJoin(students, eq(students.id, payments.studentId)).leftJoin(recorder, eq(recorder.id, payments.recordedByUserId)).leftJoin(approver, eq(approver.id, payments.approvedByUserId))
    .where(and(inArray(payments.id, idList), eq(payments.schoolId, m.schoolId), eq(payments.status, "approved")));
  if (rows.length === 0) return empty;

  const [school, balances] = await Promise.all([
    db.select().from(schools).where(eq(schools.id, m.schoolId)).limit(1).then((r) => r[0]),
    Promise.all(rows.map((r) => invoiceBalance(r.invoiceId))),
  ]);
  const order = new Map(idList.map((id, idx) => [id, idx]));
  const items = rows.map((r, idx) => ({ row: r, bal: balances[idx] })).sort((a, b) => (order.get(a.row.id) ?? 0) - (order.get(b.row.id) ?? 0));

  return (
    <div className="min-h-screen bg-paper py-10 print:bg-white print:py-0">
      <div className="mx-auto w-[min(640px,calc(100%-32px))]">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <span className="text-[12px] font-extrabold text-ink-soft">{items.length} receipt{items.length === 1 ? "" : "s"}</span>
          <ReceiptActions />
        </div>
        <div className="grid gap-6 print:gap-0">
          {items.map(({ row, bal }, idx) => (
            <div key={row.id} className={idx > 0 ? "print:break-before-page" : ""}>
              <ReceiptDoc p={{ ...row, invoiceTotal: bal.total, invoicePaid: bal.paid, invoiceOutstanding: bal.outstanding }} school={school} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
