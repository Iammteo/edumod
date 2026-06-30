import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, schools } from "@/db/schema";
import { InvoiceCard } from "@/components/app/invoice-card";
import { loadInvoiceBill } from "@/lib/invoice";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (!m) redirect("/dashboard");

  const [bill, school] = await Promise.all([
    loadInvoiceBill(id, m.schoolId),
    db.select().from(schools).where(eq(schools.id, m.schoolId)).limit(1).then((r) => r[0]),
  ]);
  if (!bill) return <div className="grid min-h-screen place-items-center text-[14px] text-ink-soft">Invoice not found.</div>;

  return <InvoiceCard i={bill} school={school} />;
}
