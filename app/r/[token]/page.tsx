import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { payments, schools, students, users } from "@/db/schema";
import { ReceiptCard } from "@/components/app/receipt-card";
import { invoiceBalance } from "@/lib/receipt";

// Public, token-gated receipt. The receiptKey (a random UUID minted on approval) IS the secret,
// so parents can open/download/print without a login. Only approved payments have a token.
export default async function PublicReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const notFound = <div className="grid min-h-screen place-items-center text-[14px] text-ink-soft">Receipt not found.</div>;
  if (!token || token.length < 8) return notFound;

  const recorder = users, approver = alias(users, "approver");
  const [p] = await db.select({ id: payments.id, amount: payments.amount, method: payments.method, status: payments.status, description: payments.description, createdAt: payments.createdAt, approvedAt: payments.approvedAt, proofKey: payments.proofKey, receiptKey: payments.receiptKey, invoiceId: payments.invoiceId, schoolId: payments.schoolId, sf: students.firstName, sl: students.lastName, admissionNo: students.admissionNo, className: students.className, recordedBy: recorder.name, approvedBy: approver.name })
    .from(payments).innerJoin(students, eq(students.id, payments.studentId)).leftJoin(recorder, eq(recorder.id, payments.recordedByUserId)).leftJoin(approver, eq(approver.id, payments.approvedByUserId))
    .where(eq(payments.receiptKey, token)).limit(1);
  if (!p || p.status !== "approved") return notFound;
  const [school, bal] = await Promise.all([
    db.select().from(schools).where(eq(schools.id, p.schoolId)).limit(1).then((r) => r[0]),
    invoiceBalance(p.invoiceId),
  ]);

  return <ReceiptCard p={{ ...p, invoiceTotal: bal.total, invoicePaid: bal.paid, invoiceOutstanding: bal.outstanding }} school={school} shareToken={p.receiptKey} />;
}
