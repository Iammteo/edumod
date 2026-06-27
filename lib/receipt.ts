import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices, payments } from "@/db/schema";

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
