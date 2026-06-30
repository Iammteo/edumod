// Reuses the receipt action bar (Back + Download/Print) — generic when no share token is passed.
import { ReceiptActions } from "./receipt-actions";
import type { InvoiceBill } from "@/lib/invoice";

export type InvoiceSchool = { name: string | null; address: string | null; state: string | null; country: string | null; schoolCode: string | null } | undefined;

// Printable invoice document — staff route (/invoice/[id]). Mirrors the receipt layout so the two
// documents feel consistent.
export function InvoiceCard({ i, school }: { i: InvoiceBill; school: InvoiceSchool }) {
  return (
    <div className="min-h-screen bg-paper py-10 print:bg-white print:py-0">
      <div className="mx-auto w-[min(640px,calc(100%-32px))]">
        <div className="mb-4"><ReceiptActions /></div>
        <InvoiceDoc i={i} school={school} />
      </div>
    </div>
  );
}

// The invoice document itself (no page chrome) - reused for single and batch (print-all) views.
export function InvoiceDoc({ i, school }: { i: InvoiceBill; school: InvoiceSchool }) {
  const naira = (n: number) => `₦${Number(n).toLocaleString()}`;
  const date = new Date(i.createdAt).toLocaleDateString();
  const isPaid = i.outstanding <= 0;
  const isPartial = i.paid > 0 && !isPaid;
  const status = isPaid ? "Paid" : isPartial ? "Partially paid" : "Unpaid";
  const rows: [string, string][] = [
    ["Invoice no.", i.no], ["Date issued", date],
    ...(i.dueDate ? ([["Due date", new Date(i.dueDate).toLocaleDateString()]] as [string, string][]) : []),
    ...(i.billName ? ([["Bill", i.billName]] as [string, string][]) : []),
    ...(i.termLabel ? ([["Term", i.termLabel]] as [string, string][]) : []),
    ["Student", i.studentName], ["Admission no.", i.admissionNo],
    ...(i.className ? ([["Class", i.className]] as [string, string][]) : []),
    ["Status", status],
  ];

  return (
        <div className="rounded-2xl border border-border-soft bg-white p-8 print:border-0 print:p-0">
          <div className="flex items-start justify-between border-b border-border-soft pb-5">
            <div><div className="inline-flex items-center gap-2 font-display text-[22px] font-semibold"><span className="grid size-6 rotate-45 place-items-center border-2 border-brand-green"><i className="size-[7px] border-2 border-brand-green" /></span>{school?.name ?? "Edumod"}</div><p className="mt-1 text-[12px] text-ink-soft">{[school?.address, school?.state, school?.country].filter(Boolean).join(", ")}</p></div>
            <div className="text-right"><div className="font-display text-[18px] font-semibold">Invoice</div><div className="text-[12px] text-ink-soft">School code: {school?.schoolCode}</div></div>
          </div>
          <div className="my-6 grid place-items-center"><div className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">Amount due</div><div className={`font-display text-[40px] font-bold ${isPaid ? "text-brand-green" : "text-[#b9540f]"}`}>{naira(i.outstanding)}</div></div>
          <dl className="grid gap-0">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-border-soft py-3 last:border-0"><dt className="text-[12px] font-bold text-ink-soft">{k}</dt><dd className="text-right text-[13px] font-bold text-ink">{v}</dd></div>)}</dl>

          <div className="mt-6">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft">Fee breakdown</div>
            <table className="w-full text-left text-[12px]">
              <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="py-2 font-bold">Item</th><th className="py-2 text-right font-bold">Amount</th></tr></thead>
              <tbody>{i.lines.map((l) => (
                <tr key={l.id} className="border-b border-border-soft last:border-0">
                  <td className="py-2 font-bold text-ink">{l.description}{!l.mandatory && <span className="ml-2 rounded-full bg-[#fdf6e9] px-2 py-0.5 text-[9px] font-extrabold text-[#b9540f]">Optional</span>}</td>
                  <td className="py-2 text-right font-bold text-ink">{naira(l.amount)}</td>
                </tr>
              ))}</tbody>
              <tfoot><tr className="border-t-2 border-border-soft"><td className="py-2 text-[12px] font-extrabold text-ink">Total</td><td className="py-2 text-right text-[13px] font-extrabold text-ink">{naira(i.total)}</td></tr></tfoot>
            </table>
          </div>

          <div className="mt-4 grid gap-2">
            <div className="flex items-center justify-between rounded-xl border border-border-soft bg-paper/50 px-4 py-2.5"><span className="text-[12px] font-bold text-ink-soft">Amount paid</span><span className="font-display text-[15px] font-bold text-brand-green">{naira(i.paid)}</span></div>
            <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${isPaid ? "border-brand-green/30 bg-brand-green/10" : "border-[#f0d3a8] bg-[#fdf6e9]"}`}>
              <span className={`text-[12px] font-extrabold uppercase tracking-wide ${isPaid ? "text-brand-green" : "text-[#b9540f]"}`}>{isPaid ? "Balance - fully paid" : "Outstanding balance"}</span>
              <span className={`font-display text-[20px] font-bold ${isPaid ? "text-brand-green" : "text-[#b9540f]"}`}>{naira(i.outstanding)}</span>
            </div>
          </div>
          <p className="mt-6 text-center text-[11px] text-ink-soft">This is a system-generated invoice from Edumod.</p>
        </div>
  );
}
