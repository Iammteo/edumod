import { ReceiptActions } from "./receipt-actions";

export type ReceiptData = {
  id: string;
  amount: string | number;
  method: string;
  status: string;
  description: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  proofKey: string | null;
  receiptKey: string | null;
  sf: string;
  sl: string;
  admissionNo: string;
  className?: string | null;
  // Invoice context (when the payment was applied to a specific fee), for partial-payment receipts.
  invoiceTotal?: number | null;
  invoicePaid?: number | null;
  invoiceOutstanding?: number | null;
  recordedBy?: string | null;
  approvedBy?: string | null;
};
export type ReceiptSchool = { name: string | null; address: string | null; state: string | null; country: string | null; schoolCode: string | null } | undefined;

// Shared receipt document - rendered by the staff route (/receipt/[id]) and the public share
// route (/r/[token]). `shareToken` enables the Share button; pass null to hide it.
export function ReceiptCard({ p, school, shareToken }: { p: ReceiptData; school: ReceiptSchool; shareToken?: string | null }) {
  return (
    <div className="min-h-screen bg-paper py-10 print:bg-white print:py-0">
      <div className="mx-auto w-[min(640px,calc(100%-32px))]">
        <div className="mb-4"><ReceiptActions shareToken={shareToken} /></div>
        <ReceiptDoc p={p} school={school} shareToken={shareToken} />
      </div>
    </div>
  );
}

// The receipt document itself (no page chrome) - reused for single and batch (print-all) views.
export function ReceiptDoc({ p, school, shareToken }: { p: ReceiptData; school: ReceiptSchool; shareToken?: string | null }) {
  const no = `RCP-${p.id.slice(0, 8).toUpperCase()}`;
  // Proofs are served through the auth-gated route; the share token lets the receipt holder view it.
  const proofSrc = p.proofKey ? `/api/proof/${p.id}${shareToken ? `?token=${encodeURIComponent(shareToken)}` : ""}` : null;
  const naira = (n: number) => `₦${Number(n).toLocaleString()}`;
  const amount = naira(Number(p.amount));
  const date = new Date(p.approvedAt ?? p.createdAt).toLocaleDateString();
  const hasInvoice = p.invoiceTotal != null && p.invoiceTotal > 0;
  const outstanding = p.invoiceOutstanding ?? 0;
  const isPartial = hasInvoice && outstanding > 0;
  const amountNow = Number(p.amount);
  const previousPaid = Math.max(0, (p.invoicePaid ?? 0) - amountNow);
  const rows: [string, string][] = [
    ["Receipt no.", no], ["Date", date], ["Student", `${p.sf} ${p.sl}`.trim()], ["Admission no.", p.admissionNo],
    ...(p.className ? ([["Class", p.className]] as [string, string][]) : []),
    ["Description", p.description || "School fees"], ["Method", p.method === "transfer" ? "Bank transfer" : "Cash"], ["Status", p.status === "approved" ? "Approved" : p.status],
    ...(hasInvoice ? ([
      ["Fee total", naira(p.invoiceTotal!)],
      ["Previous amount paid", naira(previousPaid)],
      ["Amount paid now", naira(amountNow)],
      ["Total paid to date", naira(p.invoicePaid ?? 0)],
    ] as [string, string][]) : []),
  ];

  return (
        <div className="rounded-2xl border border-border-soft bg-white p-8 print:border-0 print:p-0">
          <div className="flex items-start justify-between border-b border-border-soft pb-5">
            <div><div className="inline-flex items-center gap-2 font-display text-[22px] font-semibold"><span className="grid size-6 rotate-45 place-items-center border-2 border-brand-green"><i className="size-[7px] border-2 border-brand-green" /></span>{school?.name ?? "Edumod"}</div><p className="mt-1 text-[12px] text-ink-soft">{[school?.address, school?.state, school?.country].filter(Boolean).join(", ")}</p></div>
            <div className="text-right"><div className="font-display text-[18px] font-semibold">Payment Receipt</div><div className="text-[12px] text-ink-soft">School code: {school?.schoolCode}</div></div>
          </div>
          <div className="my-6 grid place-items-center"><div className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">Amount paid</div><div className="font-display text-[40px] font-bold text-brand-green">{amount}</div></div>
          <dl className="grid gap-0">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-border-soft py-3 last:border-0"><dt className="text-[12px] font-bold text-ink-soft">{k}</dt><dd className="text-right text-[13px] font-bold text-ink">{v}</dd></div>)}</dl>
          {hasInvoice && (
            <div className={`mt-4 flex items-center justify-between rounded-xl border px-4 py-3 ${isPartial ? "border-[#f0d3a8] bg-[#fdf6e9]" : "border-brand-green/30 bg-brand-green/10"}`}>
              <span className={`text-[12px] font-extrabold uppercase tracking-wide ${isPartial ? "text-[#b9540f]" : "text-brand-green"}`}>{isPartial ? "Outstanding balance" : "Balance - fully paid"}</span>
              <span className={`font-display text-[20px] font-bold ${isPartial ? "text-[#b9540f]" : "text-brand-green"}`}>{naira(outstanding)}</span>
            </div>
          )}
          {isPartial && <p className="mt-2 text-center text-[11px] font-bold text-[#b9540f]">This is a part-payment. ₦{outstanding.toLocaleString()} is still outstanding on this fee.</p>}
          {(p.recordedBy || p.approvedBy) && (
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border-soft pt-4 text-[11px]">
              <div><div className="font-bold uppercase tracking-wide text-ink-soft">Recorded by</div><div className="mt-0.5 text-[13px] font-bold text-ink">{p.recordedBy ?? "-"}</div></div>
              <div className="text-right"><div className="font-bold uppercase tracking-wide text-ink-soft">Approved by</div><div className="mt-0.5 text-[13px] font-bold text-ink">{p.approvedBy ?? "-"}</div></div>
            </div>
          )}
          {proofSrc && <div className="mt-6"><div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft">Proof of payment</div><img src={proofSrc} alt="Proof of payment" className="max-h-72 w-full rounded-xl border border-border-soft object-contain" /></div>}
          <p className="mt-6 text-center text-[11px] text-ink-soft">This is a system-generated receipt from Edumod. Thank you.</p>
        </div>
  );
}
