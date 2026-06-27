"use client";

import { useState } from "react";

// Print / Save-as-PDF + Share (native share sheet on mobile, copy-link fallback elsewhere).
export function ReceiptActions({ shareToken }: { shareToken?: string | null }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = typeof window !== "undefined" ? `${window.location.origin}/r/${shareToken}` : "";
    try {
      if (navigator.share) await navigator.share({ title: "Payment receipt", text: "Your payment receipt", url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* user dismissed the share sheet */ }
  }
  return (
    <div className="flex flex-wrap justify-end gap-2 print:hidden">
      <a href="/dashboard" className="rounded-[10px] border border-border-soft bg-white px-4 py-2 text-[12px] font-extrabold text-ink-soft transition hover:border-brand-blue hover:text-brand-blue">← Back</a>
      {shareToken && <button onClick={share} className="rounded-[10px] border border-border-soft bg-white px-4 py-2 text-[12px] font-extrabold text-ink-soft transition hover:border-brand-blue hover:text-brand-blue">{copied ? "Link copied!" : "Share"}</button>}
      <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-blue px-4 py-2 text-[12px] font-extrabold text-white transition hover:bg-brand-dark">⤓ Download / Print</button>
    </div>
  );
}
