import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, schools } from "@/db/schema";
import { InvoiceDoc } from "@/components/app/invoice-card";
import { ReceiptActions } from "@/components/app/receipt-actions";
import { loadInvoiceBills, loadInvoiceBillsByFilter } from "@/lib/invoice";

// Batch invoice view — print/download several invoices at once. Either an explicit selection
// (?ids=a,b,c) or a Reports filter (?class=&term=&status=) when exporting a whole set.
export default async function InvoiceBatchPage({ searchParams }: { searchParams: Promise<{ ids?: string; class?: string; term?: string; status?: string; report?: string }> }) {
  const sp = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (!m) redirect("/dashboard");

  const idList = (sp.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const hasFilter = !!(sp.class || sp.term || sp.status || sp.report);
  const empty = <div className="grid min-h-screen place-items-center text-[14px] text-ink-soft">No invoices selected.</div>;
  if (idList.length === 0 && !hasFilter) return empty;

  const [bills, school] = await Promise.all([
    idList.length > 0
      ? loadInvoiceBills(idList, m.schoolId)
      : loadInvoiceBillsByFilter(m.schoolId, { className: sp.class, termLabel: sp.term, status: sp.status }).then((r) => r.bills),
    db.select().from(schools).where(eq(schools.id, m.schoolId)).limit(1).then((r) => r[0]),
  ]);
  if (bills.length === 0) return empty;

  return (
    <div className="min-h-screen bg-paper py-10 print:bg-white print:py-0">
      <div className="mx-auto w-[min(640px,calc(100%-32px))]">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <span className="text-[12px] font-extrabold text-ink-soft">{bills.length} invoice{bills.length === 1 ? "" : "s"}</span>
          <ReceiptActions />
        </div>
        <div className="grid gap-6 print:gap-0">
          {bills.map((bill, idx) => (
            <div key={bill.id} className={idx > 0 ? "print:break-before-page" : ""}>
              <InvoiceDoc i={bill} school={school} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
