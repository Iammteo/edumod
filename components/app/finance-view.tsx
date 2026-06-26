"use client";

import { useCallback, useEffect, useState } from "react";
import { getFinanceData, recordPayment, approvePayment, rejectPayment, type FinanceData } from "@/lib/actions/finance";

const naira = (n: number) => `₦${n.toLocaleString()}`;
const compact = (n: number) => (n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `₦${(n / 1000).toFixed(0)}k` : `₦${n}`);

export function FinanceView({ initial }: { initial?: FinanceData }) {
  const [data, setData] = useState<FinanceData | null>(initial ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const r = await getFinanceData();
    if ("error" in r) setErr(r.error);
    else { setData(r); setErr(null); }
  }, []);
  // Live: refresh on mount and every 5s so approvals/payments by anyone appear in near real-time.
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  async function onRecord(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy("record"); setErr(null);
    const r = await recordPayment({ studentId: String(fd.get("studentId") || ""), amount: Number(fd.get("amount") || 0), method: String(fd.get("method") || "cash"), description: String(fd.get("description") || "") });
    setBusy(null);
    if ("error" in r) { setErr(r.error); return; }
    (e.target as HTMLFormElement).reset(); setShowForm(false); load();
  }
  async function approve(id: string) { setBusy(id); const r = await approvePayment(id); setBusy(null); if ("error" in r) setErr(r.error); else { setErr(null); load(); } }
  async function reject(id: string) { const reason = window.prompt("Reason for rejecting this payment?") ?? ""; if (reason === null) return; setBusy(id); const r = await rejectPayment(id, reason); setBusy(null); if ("error" in r) setErr(r.error); else { setErr(null); load(); } }

  if (!data) return <div className="grid place-items-center py-20 text-[13px] text-ink-soft">Loading finance…</div>;
  const s = data.stats;
  const stats = [["Total collected", compact(s.collected), "#178a4c", "#e7f6ee"], ["Pending approval", String(s.pendingCount), "#b9540f", "#fbeee3"], ["Pending amount", compact(s.pending), "#2159e8", "#e7eefc"], ["Collected this month", compact(s.thisMonth), "#6b2fb3", "#f0e9fa"]] as const;

  return (
    <>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3"><div><h1 className="font-display text-[clamp(21px,3.5vw,28px)] font-semibold leading-tight">Finance</h1><p className="mt-0.5 text-[13px] text-ink-soft">Record payments and approve them with maker-checker control.</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-2.5 py-1 text-[10px] font-extrabold text-brand-green"><span className="size-1.5 animate-pulse rounded-full bg-brand-green" />Live</span></div>
        {data.canRecord && <button onClick={() => setShowForm((v) => !v)} className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-[10px] bg-brand-blue px-4 text-[13px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark sm:self-auto">{showForm ? "Close" : "+ Record payment"}</button>}
      </div>

      {err && <div className="mb-4 rounded-[12px] border border-[#f3c2c2] bg-[#fdeeee] px-3.5 py-2.5 text-[12px] font-bold text-[#b3261e]">{err}</div>}

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, color, bg]) => <div key={label} className="rounded-2xl border border-border-soft bg-white p-[18px]"><div className="flex items-center justify-between"><div><small className="font-bold text-ink-soft">{label}</small><strong className="mt-2 block font-display text-[26px] font-semibold leading-none">{value}</strong></div><span className="grid size-9 place-items-center rounded-full" style={{ backgroundColor: bg, color }}>₦</span></div></div>)}</div>

      {showForm && data.canRecord && (
        <div className="mt-[18px] rounded-2xl border border-border-soft bg-white p-5">
          <h2 className="mb-3.5 font-display text-[16px] font-semibold">Record a payment</h2>
          {data.students.length === 0 ? <p className="text-[12px] text-ink-soft">Add students first (Students tab) before recording payments.</p> : (
            <form onSubmit={onRecord} className="grid gap-3.5 sm:grid-cols-2">
              <label className="grid gap-1.5"><span className="text-[11px] font-extrabold text-ink">Student</span><select name="studentId" required className="min-h-10 rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] outline-none focus:border-brand-blue focus:bg-white">{data.students.map((st) => <option key={st.id} value={st.id}>{st.name} ({st.admissionNo})</option>)}</select></label>
              <label className="grid gap-1.5"><span className="text-[11px] font-extrabold text-ink">Amount (₦)</span><input name="amount" type="number" min="1" step="0.01" required placeholder="120000" className="min-h-10 rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] outline-none focus:border-brand-blue focus:bg-white" /></label>
              <label className="grid gap-1.5"><span className="text-[11px] font-extrabold text-ink">Method</span><select name="method" className="min-h-10 rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] outline-none focus:border-brand-blue focus:bg-white"><option value="cash">Cash</option><option value="transfer">Bank transfer</option></select></label>
              <label className="grid gap-1.5"><span className="text-[11px] font-extrabold text-ink">Description</span><input name="description" placeholder="Term 2 tuition" className="min-h-10 rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] outline-none focus:border-brand-blue focus:bg-white" /></label>
              <div className="sm:col-span-2"><button type="submit" disabled={busy === "record"} className="inline-flex min-h-10 items-center rounded-[10px] bg-brand-blue px-5 text-[13px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-70">{busy === "record" ? "Recording…" : "Submit for approval"}</button><span className="ml-3 text-[11px] text-ink-soft">It will need approval by a different staff member.</span></div>
            </form>
          )}
        </div>
      )}

      <div className="mt-[18px] rounded-2xl border border-border-soft bg-white p-5">
        <h2 className="mb-3.5 font-display text-[16px] font-semibold">Payments</h2>
        {data.payments.length === 0 ? <div className="grid place-items-center rounded-xl border border-dashed border-border-soft py-10 text-[12px] text-ink-soft">No payments yet. Record one to get started.</div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-[12px]">
            <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="py-2 font-bold">Student</th><th className="py-2 font-bold">Amount</th><th className="py-2 font-bold">Method</th><th className="py-2 font-bold">Recorded by</th><th className="py-2 font-bold">Date</th><th className="py-2 font-bold">Status</th><th className="py-2 text-right font-bold">Action</th></tr></thead>
            <tbody>{data.payments.map((p) => <tr key={p.id} className="border-b border-border-soft last:border-0 hover:bg-paper/60">
              <td className="py-2.5"><div className="font-bold text-ink">{p.student}</div><div className="text-[10px] text-ink-soft">{p.description || p.admissionNo}</div></td>
              <td className="py-2.5 font-extrabold text-ink">{naira(p.amount)}</td>
              <td className="py-2.5 capitalize text-ink-soft">{p.method}</td>
              <td className="py-2.5 text-ink-soft">{p.recordedBy}{p.mine && <span className="ml-1 text-[10px] text-brand-blue">(you)</span>}</td>
              <td className="py-2.5 text-ink-soft">{p.date}</td>
              <td className="py-2.5">{p.status === "approved" ? <Pill tone="green">Approved</Pill> : p.status === "rejected" ? <Pill tone="red">Rejected</Pill> : <Pill tone="amber">Pending</Pill>}</td>
              <td className="py-2.5 text-right">{p.status === "pending_approval" ? (data.canApprove && !p.mine ? <div className="inline-flex gap-1.5"><button onClick={() => approve(p.id)} disabled={busy === p.id} className="rounded-md bg-brand-green/10 px-2 py-1 text-[11px] font-extrabold text-brand-green hover:bg-brand-green/20 disabled:opacity-50">Approve</button><button onClick={() => reject(p.id)} disabled={busy === p.id} className="rounded-md bg-[#fdeeee] px-2 py-1 text-[11px] font-extrabold text-[#b3261e] hover:bg-[#fbe3e3] disabled:opacity-50">Reject</button></div> : <span className="text-[10px] text-ink-soft">{p.mine ? "Awaiting another approver" : "Awaiting approval"}</span>) : <span className="text-ink-soft">—</span>}</td>
            </tr>)}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

function Pill({ tone, children }: { tone: "green" | "red" | "amber"; children: React.ReactNode }) {
  const c = tone === "green" ? "bg-brand-green/10 text-brand-green" : tone === "red" ? "bg-[#fdeeee] text-[#b3261e]" : "bg-[#fdf6e9] text-[#b9540f]";
  const dot = tone === "green" ? "bg-brand-green" : tone === "red" ? "bg-[#b3261e]" : "bg-[#b9540f]";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${c}`}><span className={`size-1.5 rounded-full ${dot}`} />{children}</span>;
}
