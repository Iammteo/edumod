"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getClassFinance, getClassDetail, getOutstandingStudents, type ClassFinance, type ClassRow, type ClassDetail } from "@/lib/actions/class-finance";
import { exportReport } from "@/lib/export-report";

const naira = (n: number) => `₦${Math.round(n).toLocaleString()}`;
const compact = (n: number) => (n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M` : n >= 1000 ? `₦${Math.round(n / 1000)}k` : `₦${n}`);
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const AV = ["#2159e8", "#178a4c", "#b9540f", "#6b2fb3", "#0f8a8a", "#c0392b"];
const LEVELS = ["All", "Primary", "JSS", "SSS", "Secondary"];
const matchLevel = (level: string, classLevel: string) => level === "All" || (level === "Secondary" ? classLevel === "JSS" || classLevel === "SSS" : classLevel === level);
const FEE_COLORS = ["#2159e8", "#178a4c", "#b9540f", "#c0392b", "#6b2fb3", "#0f8a8a"];
const statusPill = (s: string) => s === "cleared" ? ["Cleared", "bg-brand-green/10 text-brand-green"] : s === "at_risk" ? ["Exam at risk", "bg-[#fdeeee] text-[#b3261e]"] : ["Needs follow-up", "bg-[#fdf6e9] text-[#b9540f]"];
const stuPill = (s: string) => s === "cleared" ? ["Cleared", "bg-brand-green/10 text-brand-green"] : s === "partial" ? ["Partial payment", "bg-[#fdf6e9] text-[#b9540f]"] : ["Unpaid", "bg-[#fdeeee] text-[#b3261e]"];

export function ClassFinanceView({ onViewInvoices }: { onViewInvoices?: () => void }) {
  const [data, setData] = useState<ClassFinance | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [level, setLevel] = useState("All");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [stuQ, setStuQ] = useState("");
  const [includePhone, setIncludePhone] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const r = await getClassFinance();
    if ("error" in r) { setErr(r.error); return; }
    setErr(null); setData(r);
    setSelected((cur) => cur ?? r.classes[0]?.className ?? null);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  const loadDetail = useCallback(async (cn: string) => { const r = await getClassDetail(cn); if (!("error" in r)) setDetail(r); }, []);
  useEffect(() => { if (selected) loadDetail(selected); }, [selected, loadDetail]);

  const filtered = useMemo(() => (data?.classes ?? []).filter((c) => matchLevel(level, c.level) && (status === "all" || c.status === status) && c.className.toLowerCase().includes(q.toLowerCase())), [data, level, status, q]);

  async function runExport(format: "excel" | "word" | "pdf" | "csv") {
    setExportOpen(false); setExporting(true);
    const r = await getOutstandingStudents();
    setExporting(false);
    if ("error" in r) { setErr(r.error); return; }
    const allowed = new Set(filtered.map((c) => c.className));
    const rows = r.filter((s) => allowed.has(s.className)).map((s) => ({ class: s.className, student: s.student, guardian: s.guardian || "—", phone: s.phone || "—", paid: naira(s.paid), outstanding: naira(s.outstanding), status: s.status }));
    const columns = [{ key: "class", label: "Class" }, { key: "student", label: "Student" }, { key: "guardian", label: "Guardian" }, ...(includePhone ? [{ key: "phone", label: "Parent phone" }] : []), { key: "paid", label: "Amount paid" }, { key: "outstanding", label: "Outstanding" }, { key: "status", label: "Status" }];
    const scope = level === "All" ? "all classes" : level;
    exportReport(format, { title: "Outstanding students report", subtitle: `${scope} · ${rows.length} students · generated ${new Date().toLocaleDateString()}`, columns, rows, filename: `outstanding-${level.toLowerCase()}` });
  }

  if (!data) return <div className="grid place-items-center py-20 text-[13px] text-ink-soft">{err ?? "Loading class finance…"}</div>;
  const t = data.totals;
  const stats = [
    { label: "Total expected", value: compact(t.expected), sub: `From ${t.totalClasses} class${t.totalClasses === 1 ? "" : "es"}`, c: "#178a4c", bg: "#e7f6ee" },
    { label: "Total collected", value: compact(t.collected), sub: `${t.rate}% of expected`, c: "#2159e8", bg: "#e7eefc" },
    { label: "Total outstanding", value: compact(t.outstanding), sub: `${Math.max(0, Math.round((100 - t.rate) * 10) / 10)}% remaining`, c: "#b9540f", bg: "#fbeee3" },
    { label: "Overpaid credit", value: compact(t.overpaidCredit), sub: `${t.overpaidCount} student${t.overpaidCount === 1 ? "" : "s"}`, c: "#0f8a8a", bg: "#e0f2f1" },
    { label: "Collection rate", value: `${t.rate}%`, sub: "Across all classes", c: "#6b2fb3", bg: "#f0e9fa" },
    { label: "Classes needing follow-up", value: `${t.classesWithBalance} of ${t.totalClasses}`, sub: t.classesWithBalance ? "Have a balance" : "All cleared", c: "#c0392b", bg: "#fdeeee" },
  ];
  const top = [...data.classes].filter((c) => c.outstanding > 0).slice(0, 5);
  const maxTop = Math.max(1, ...top.map((c) => c.outstanding));
  const studentsFiltered = (detail?.studentRows ?? []).filter((s) => s.name.toLowerCase().includes(stuQ.toLowerCase()));

  return (
    <>
      <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div><h1 className="font-display text-[clamp(21px,3.5vw,28px)] font-semibold leading-tight">Class finance summary</h1><p className="mt-0.5 text-[13px] text-ink-soft">Track fee performance for each class and spot outstanding balances quickly.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-bold text-ink-soft"><input type="checkbox" checked={includePhone} onChange={(e) => setIncludePhone(e.target.checked)} className="size-3.5 accent-brand-blue" />Include parent phone</label>
          <div className="relative">
            <button onClick={() => setExportOpen((v) => !v)} disabled={exporting} className="inline-flex min-h-10 items-center gap-1.5 rounded-[12px] border border-border-soft bg-white px-4 text-[13px] font-extrabold text-ink transition hover:border-brand-blue hover:text-brand-blue disabled:opacity-60">⤓ {exporting ? "Exporting…" : "Export"} ▾</button>
            {exportOpen && <><div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} /><div className="absolute right-0 z-50 mt-1 w-44 rounded-xl border border-border-soft bg-white p-1 shadow-[0_20px_50px_rgba(16,33,63,.16)]">{([["excel", "Export to Excel"], ["pdf", "Export to PDF"], ["word", "Export to Word"], ["csv", "Export to CSV"]] as const).map(([f, label]) => <button key={f} onClick={() => runExport(f)} className="block w-full rounded-lg px-3 py-2 text-left text-[12px] font-bold text-ink-soft hover:bg-paper hover:text-brand-blue">{label}</button>)}</div></>}
          </div>
          {onViewInvoices && <button onClick={onViewInvoices} className="inline-flex min-h-10 items-center gap-1.5 rounded-[12px] bg-brand-blue px-4 text-[13px] font-extrabold text-white transition hover:bg-brand-dark">View invoices</button>}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border-soft bg-white p-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Level</span>
          {LEVELS.map((l) => <button key={l} onClick={() => setLevel(l)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${level === l ? "bg-brand-blue text-white" : "bg-paper text-ink-soft hover:text-brand-blue"}`}>{l}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-9 rounded-[10px] border border-border-soft bg-white px-2.5 text-[12px] font-bold text-ink-soft outline-none"><option value="all">All statuses</option><option value="cleared">Cleared</option><option value="follow_up">Needs follow-up</option><option value="at_risk">Exam at risk</option></select>
          <div className="flex items-center gap-1.5 rounded-[10px] border border-border-soft bg-paper/60 px-2.5"><span className="text-ink-soft">⌕</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search class…" className="min-h-9 w-32 bg-transparent text-[12px] outline-none" /></div>
          {(level !== "All" || status !== "all" || q) && <button onClick={() => { setLevel("All"); setStatus("all"); setQ(""); }} className="text-[12px] font-extrabold text-brand-blue hover:underline">Reset</button>}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((st) => <div key={st.label} className="rounded-2xl border border-border-soft bg-white p-[18px]"><div className="flex items-start justify-between gap-2"><small className="font-bold text-ink-soft">{st.label}</small><span className="grid size-9 shrink-0 place-items-center rounded-full text-[14px]" style={{ backgroundColor: st.bg, color: st.c }}>₦</span></div><strong className="mt-2.5 block break-words font-display text-[clamp(17px,4.5vw,24px)] font-semibold leading-none">{st.value}</strong><div className="mt-2 text-[11px] font-bold text-ink-soft">{st.sub}</div></div>)}
      </div>

      {/* Overview + selected */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <section className="rounded-2xl border border-border-soft bg-white p-5">
          <h2 className="mb-3 font-display text-[15px] font-semibold">Class collection overview</h2>
          {filtered.length === 0 ? <div className="grid place-items-center rounded-xl border border-dashed border-border-soft py-10 text-[12px] text-ink-soft">No classes match. Issue fees to a class to see it here.</div> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[12px]">
              <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="py-2 font-bold">Class</th><th className="py-2 text-center font-bold">Students</th><th className="py-2 font-bold">Assigned</th><th className="py-2 font-bold">Paid</th><th className="py-2 font-bold">Outstanding</th><th className="py-2 font-bold">Rate</th><th className="py-2 font-bold">Status</th><th className="hidden py-2 font-bold md:table-cell">Last payment</th></tr></thead>
              <tbody>{filtered.map((c) => { const [sl, sc] = statusPill(c.status); const sel = selected === c.className; return (
                <tr key={c.className} onClick={() => setSelected(c.className)} className={`cursor-pointer border-b border-border-soft last:border-0 ${sel ? "bg-brand-soft/50" : "hover:bg-paper/60"}`}>
                  <td className="py-2.5"><div className="font-bold text-ink">{c.className}</div><div className="text-[10px] text-ink-soft">{c.level}</div></td>
                  <td className="py-2.5 text-center text-ink-soft">{c.students}</td>
                  <td className="py-2.5 text-ink-soft">{naira(c.expected)}</td>
                  <td className="py-2.5 font-bold text-ink">{naira(c.collected)}</td>
                  <td className="py-2.5 font-extrabold text-[#b3261e]">{naira(c.outstanding)}</td>
                  <td className="py-2.5"><div className="flex items-center gap-1.5"><span className="h-1.5 w-12 overflow-hidden rounded-full bg-paper"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, c.rate)}%`, backgroundColor: c.rate >= 60 ? "#178a4c" : "#2159e8" }} /></span><span className="text-[10px] font-bold text-ink-soft">{c.rate}%</span></div></td>
                  <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${sc}`}>{sl}</span></td>
                  <td className="hidden py-2.5 text-ink-soft md:table-cell">{c.lastPayment ?? "—"}</td>
                </tr>); })}</tbody>
            </table></div>
          )}
          <p className="mt-3 text-[11px] text-ink-soft">Showing {filtered.length} of {data.classes.length} classes</p>
        </section>

        <SelectedClass detail={detail} onViewInvoices={onViewInvoices} />
      </div>

      {/* Top outstanding + students */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[.8fr_1.6fr]">
        <section className="rounded-2xl border border-border-soft bg-white p-5">
          <h2 className="mb-3 flex items-center gap-1.5 font-display text-[15px] font-semibold"><span className="text-[#b3261e]">⚠</span>Top outstanding classes</h2>
          {top.length === 0 ? <p className="text-[12px] text-ink-soft">No outstanding balances. 🎉</p> : <div className="grid gap-2.5">{top.map((c) => <button key={c.className} onClick={() => setSelected(c.className)} className="grid gap-1 text-left"><div className="flex items-center justify-between text-[11px]"><span className="font-bold text-ink">{c.className}</span><span className="font-extrabold text-[#b3261e]">{naira(c.outstanding)}</span></div><span className="h-2 overflow-hidden rounded-full bg-paper"><span className="block h-full rounded-full bg-[#e5484d]" style={{ width: `${Math.round((c.outstanding / maxTop) * 100)}%` }} /></span></button>)}</div>}
        </section>

        <section className="rounded-2xl border border-border-soft bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-[15px] font-semibold">Students with balances{detail ? ` · ${detail.className}` : ""}</h2><div className="flex items-center gap-1.5 rounded-[10px] border border-border-soft bg-paper/60 px-2.5"><span className="text-ink-soft">⌕</span><input value={stuQ} onChange={(e) => setStuQ(e.target.value)} placeholder="Search student…" className="min-h-9 w-32 bg-transparent text-[12px] outline-none" /></div></div>
          {!detail || studentsFiltered.length === 0 ? <div className="grid place-items-center rounded-xl border border-dashed border-border-soft py-10 text-[12px] text-ink-soft">{detail ? "No students with balances here." : "Select a class to see its students."}</div> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[12px]">
              <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="py-2 font-bold">Student</th><th className="hidden py-2 font-bold sm:table-cell">Guardian</th><th className="py-2 font-bold">Paid</th><th className="py-2 font-bold">Outstanding</th><th className="py-2 font-bold">Status</th><th className="hidden py-2 font-bold md:table-cell">Last payment</th></tr></thead>
              <tbody>{studentsFiltered.slice(0, 12).map((s) => { const [sl, sc] = stuPill(s.status); return (
                <tr key={s.id} className="border-b border-border-soft last:border-0 hover:bg-paper/60">
                  <td className="py-2.5"><div className="flex items-center gap-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ backgroundColor: AV[s.name.length % AV.length] }}>{initials(s.name)}</span><span className="font-bold text-ink">{s.name}</span></div></td>
                  <td className="hidden py-2.5 sm:table-cell"><div className="text-ink-soft">{s.guardian || "—"}</div><div className="text-[10px] text-ink-soft">{s.guardianPhone}</div></td>
                  <td className="py-2.5 font-bold text-ink">{naira(s.paid)}</td>
                  <td className={`py-2.5 font-extrabold ${s.outstanding > 0 ? "text-[#b3261e]" : "text-brand-green"}`}>{naira(s.outstanding)}</td>
                  <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${sc}`}>{sl}</span></td>
                  <td className="hidden py-2.5 text-ink-soft md:table-cell">{s.lastPayment ?? "—"}</td>
                </tr>); })}</tbody>
            </table></div>
          )}
        </section>
      </div>
    </>
  );
}

function SelectedClass({ detail, onViewInvoices }: { detail: ClassDetail | null; onViewInvoices?: () => void }) {
  if (!detail) return <section className="grid place-items-center rounded-2xl border border-border-soft bg-white p-5 text-[12px] text-ink-soft">Select a class.</section>;
  const rate = detail.expected > 0 ? (detail.collected / detail.expected) : 0;
  const pct = Math.round(rate * 1000) / 10;
  const r = 52, circ = 2 * Math.PI * r;
  return (
    <section className="rounded-2xl border border-border-soft bg-white p-5">
      <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-display text-[15px] font-semibold"><span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-extrabold text-brand-blue">{detail.className}</span>Selected class</h2>{onViewInvoices && <button onClick={onViewInvoices} className="text-[11px] font-extrabold text-brand-blue hover:underline">View invoices ↗</button>}</div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[["Students", String(detail.students)], ["Expected", naira(detail.expected)], ["Paid", naira(detail.collected)], ["Outstanding", naira(detail.outstanding)]].map(([k, v], i) => <div key={k}><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">{k}</div><div className={`mt-0.5 font-display text-[clamp(13px,3vw,16px)] font-bold leading-none ${i === 3 ? "text-[#b3261e]" : "text-ink"}`}>{v}</div></div>)}
      </div>
      <div className="mt-4 grid items-center gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-1.5 text-[11px] font-extrabold text-ink-soft">Fee items breakdown</div>
          {detail.feeItems.length === 0 ? <p className="text-[12px] text-ink-soft">No fees issued to this class yet.</p> : <ul className="grid gap-1">{detail.feeItems.map((it, i) => <li key={it.description} className="flex items-center justify-between gap-2 text-[12px]"><span className="flex items-center gap-1.5 text-ink-soft"><span className="size-2 rounded-full" style={{ backgroundColor: FEE_COLORS[i % FEE_COLORS.length] }} />{it.description}{!it.mandatory && <span className="rounded-full bg-[#fdf6e9] px-1.5 py-0.5 text-[9px] font-extrabold text-[#b9540f]">Optional</span>}</span><span className="font-bold text-ink">{naira(it.amount)}</span></li>)}</ul>}
        </div>
        <div className="mx-auto grid place-items-center">
          <div className="relative size-36">
            <svg viewBox="0 0 140 140" className="size-36 -rotate-90"><circle cx="70" cy="70" r={r} fill="none" stroke="#fde2e1" strokeWidth="16" /><circle cx="70" cy="70" r={r} fill="none" stroke="#178a4c" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${rate * circ} ${circ}`} /></svg>
            <div className="absolute inset-0 grid place-content-center text-center"><div className="font-display text-[20px] font-bold leading-none">{pct}%</div><div className="text-[10px] font-bold text-ink-soft">Collected</div></div>
          </div>
          <div className="mt-2 flex gap-3 text-[10px] font-bold"><span className="flex items-center gap-1 text-brand-green"><span className="size-2 rounded-full bg-brand-green" />Paid</span><span className="flex items-center gap-1 text-[#b3261e]"><span className="size-2 rounded-full bg-[#e5484d]" />Outstanding</span></div>
        </div>
      </div>
    </section>
  );
}
