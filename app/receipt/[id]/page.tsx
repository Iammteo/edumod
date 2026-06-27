import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, payments, schools, students, users } from "@/db/schema";
import { ReceiptCard } from "@/components/app/receipt-card";
import { invoiceBalance } from "@/lib/receipt";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (!m) redirect("/dashboard");

  const recorder = users, approver = alias(users, "approver");
  const [p] = await db.select({ amount: payments.amount, method: payments.method, status: payments.status, description: payments.description, createdAt: payments.createdAt, approvedAt: payments.approvedAt, proofKey: payments.proofKey, receiptKey: payments.receiptKey, invoiceId: payments.invoiceId, sf: students.firstName, sl: students.lastName, admissionNo: students.admissionNo, className: students.className, recordedBy: recorder.name, approvedBy: approver.name })
    .from(payments).innerJoin(students, eq(students.id, payments.studentId)).leftJoin(recorder, eq(recorder.id, payments.recordedByUserId)).leftJoin(approver, eq(approver.id, payments.approvedByUserId))
    .where(and(eq(payments.id, id), eq(payments.schoolId, m.schoolId))).limit(1);
  if (!p) return <div className="grid min-h-screen place-items-center text-[14px] text-ink-soft">Receipt not found.</div>;
  const [school, bal] = await Promise.all([
    db.select().from(schools).where(eq(schools.id, m.schoolId)).limit(1).then((r) => r[0]),
    invoiceBalance(p.invoiceId),
  ]);

  return <ReceiptCard p={{ id, ...p, invoiceTotal: bal.total, invoicePaid: bal.paid, invoiceOutstanding: bal.outstanding }} school={school} shareToken={p.receiptKey} />;
}
