"use client";

import { useCallback, useEffect, useState } from "react";
import { getAttendanceData, setClockInPin, getTeacherAttendanceReport, type AttendanceData } from "@/lib/actions/attendance";
import { exportReport } from "@/lib/export-report";

const METHOD_LABEL: Record<string, string> = { qr_scan: "QR scan", kiosk_pin: "Kiosk PIN", admin_override: "Override", self_portal: "Portal" };
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const monthStartIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };

export function StaffClockInView() {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const r = await getAttendanceData();
    if ("error" in r) setErr(r.error); else { setData(r); setErr(null); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  async function runExport(format: "pdf" | "excel" | "csv") {
    if (from > to) { setErr("The “From” date must be on or before the “To” date."); return; }
    setExporting(true); setErr(null);
    const r = await getTeacherAttendanceReport(from, to);
    setExporting(false);
    if ("error" in r) { setErr(r.error); return; }
    const multiDay = from !== to;
    const rows = r.map((row) => ({ ...row, snapshot: row.snapshot ? (row.snapshot.startsWith("http") ? row.snapshot : location.origin + row.snapshot) : "" }));
    const columns = [
      ...(multiDay ? [{ key: "date", label: "Date" }] : []),
      { key: "name", label: "Name" }, { key: "role", label: "Role" }, { key: "timeIn", label: "Time in" }, { key: "timeOut", label: "Time out" }, { key: "status", label: "Status" }, { key: "method", label: "Method" },
      ...(format === "pdf" ? [{ key: "snapshot", label: "Photo", image: true }] : []),
    ];
    // Per-staff tally across the range: on-time, late, left-early and absent counts.
    const agg = new Map<string, { name: string; role: string; onTime: number; late: number; leftEarly: number; absent: number }>();
    for (const row of r) {
      const k = `${row.name}|${row.role}`;
      const s = agg.get(k) ?? { name: row.name, role: row.role, onTime: 0, late: 0, leftEarly: 0, absent: 0 };
      if (row.status === "Absent") s.absent++;
      else { if (row.status.startsWith("Late")) s.late++; else s.onTime++; if (row.status.includes("left early")) s.leftEarly++; }
      agg.set(k, s);
    }
    const summary = {
      title: `Summary per staff (${from} → ${to})`,
      columns: [{ key: "name", label: "Name" }, { key: "role", label: "Role" }, { key: "onTime", label: "On time" }, { key: "late", label: "Late" }, { key: "leftEarly", label: "Left early" }, { key: "absent", label: "Absent" }],
      rows: [...agg.values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
    exportReport(format, { title: "Staff clock-in register", subtitle: multiDay ? `${from} → ${to}` : from, columns, rows, filename: `staff-attendance-${from}${multiDay ? `_${to}` : ""}`, summary });
  }

  if (!data) return <div className="grid place-items-center py-20 text-[13px] text-ink-soft">{err ?? "Loading attendance…"}</div>;
  const stats = [["Staff", String(data.staffTotal), "#2159e8", "#e7eefc"], ["Clocked in today", String(data.clockedIn), "#178a4c", "#e7f6ee"], ["Currently present", String(data.present), "#6b2fb3", "#f0e9fa"]] as const;

  return (
    <>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><div className="flex items-center gap-2"><h1 className="font-display text-[clamp(21px,3.5vw,28px)] font-semibold leading-tight">Attendance</h1><span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-2.5 py-1 text-[10px] font-extrabold text-brand-green"><span className="size-1.5 animate-pulse rounded-full bg-brand-green" />Live</span></div><p className="mt-0.5 text-[13px] text-ink-soft">Teacher clock-in / out via QR or kiosk PIN.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <details className="relative">
            <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-[12px] border border-border-soft bg-white px-4 text-[13px] font-extrabold text-ink transition hover:border-brand-blue hover:text-brand-blue">{exporting ? "Preparing…" : "⤓ Download register"}</summary>
            <div className="absolute right-0 z-20 mt-1.5 w-64 rounded-xl border border-border-soft bg-white p-2 shadow-lg">
              <div className="mb-1.5 grid grid-cols-2 gap-2">
                <label className="grid gap-1"><span className="px-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">From</span><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="min-h-9 rounded-[9px] border border-border-soft bg-paper/60 px-2 text-[12px] outline-none focus:border-brand-blue" /></label>
                <label className="grid gap-1"><span className="px-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">To</span><input type="date" value={to} min={from} max={todayIso()} onChange={(e) => setTo(e.target.value)} className="min-h-9 rounded-[9px] border border-border-soft bg-paper/60 px-2 text-[12px] outline-none focus:border-brand-blue" /></label>
              </div>
              <p className="px-1 py-1 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Export range</p>
              <button onClick={() => runExport("pdf")} className="block w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-bold hover:bg-paper">PDF (with photos)</button>
              <button onClick={() => runExport("excel")} className="block w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-bold hover:bg-paper">Excel</button>
              <button onClick={() => runExport("csv")} className="block w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-bold hover:bg-paper">CSV</button>
              <p className="mt-1 border-t border-border-soft px-1 pt-1.5 text-[10px] leading-relaxed text-ink-soft">The PDF ends with a per-staff summary: times on-time, late, left-early and absent.</p>
            </div>
          </details>
          <button onClick={() => setShowPin((v) => !v)} className="inline-flex min-h-10 items-center gap-1.5 rounded-[12px] border border-border-soft bg-white px-4 text-[13px] font-extrabold text-ink transition hover:border-brand-blue hover:text-brand-blue">🔑 {data.myPinSet ? "Change my PIN" : "Set my PIN"}</button>
          <a href="/kiosk" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-[12px] bg-brand-blue px-4 text-[13px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark">▣ Open terminal</a>
        </div>
      </div>

      {err && <div className="mb-4 rounded-[12px] border border-[#f3c2c2] bg-[#fdeeee] px-3.5 py-2.5 text-[12px] font-bold text-[#b3261e]">{err}</div>}
      {showPin && <div className="mb-4"><PinSetup mySet={data.myPinSet} onDone={() => { setShowPin(false); load(); }} /></div>}

      <div className="mb-4 rounded-[12px] border border-brand-soft bg-brand-soft/30 px-4 py-3 text-[12px] text-ink-soft"><strong className="text-ink">How it works:</strong> Mount a tablet at the staff entrance and open the <strong className="text-ink">terminal</strong> (it shows a QR that rotates every 5s). Teachers scan it with their phone to clock in/out. No phone? They tap “Phone dead”, pick their name, enter their 6-digit PIN, and the tablet snaps a selfie.</div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
        {stats.map(([label, value, c, bg]) => <div key={label} className="rounded-2xl border border-border-soft bg-white p-3.5 sm:p-[18px]"><div className="font-display text-[clamp(20px,5vw,28px)] font-bold leading-none" style={{ color: c }}>{value}</div><small className="mt-1.5 block font-bold text-ink-soft">{label}</small><span className="mt-2 inline-block size-2 rounded-full" style={{ backgroundColor: bg }} /></div>)}
      </div>

      <section className="mt-[18px] rounded-2xl border border-border-soft bg-white p-5">
        <h2 className="mb-3 font-display text-[16px] font-semibold">Today&rsquo;s clock-ins</h2>
        {data.logs.length === 0 ? <div className="grid place-items-center rounded-xl border border-dashed border-border-soft py-10 text-center text-[12px] text-ink-soft">No clock-ins yet today. Open the terminal to get started.</div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[460px] text-left text-[12px]">
            <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="py-2 font-bold">Teacher</th><th className="py-2 font-bold">Direction</th><th className="py-2 font-bold">Time</th><th className="hidden py-2 font-bold sm:table-cell">Method</th><th className="py-2 text-right font-bold">Selfie</th></tr></thead>
            <tbody>{data.logs.map((l) => (
              <tr key={l.id} className="border-b border-border-soft last:border-0 hover:bg-paper/60">
                <td className="py-2.5 font-bold text-ink">{l.teacher}</td>
                <td className="py-2.5"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${l.direction === "clock_in" ? "bg-brand-green/10 text-brand-green" : "bg-[#fdf6e9] text-[#b9540f]"}`}>{l.direction === "clock_in" ? "Clocked in" : "Clocked out"}</span></td>
                <td className="py-2.5 text-ink-soft">{l.time}</td>
                <td className="hidden py-2.5 text-ink-soft sm:table-cell">{METHOD_LABEL[l.method] ?? l.method}</td>
                <td className="py-2.5 text-right">{l.snapshotUrl ? <a href={l.snapshotUrl} target="_blank" rel="noreferrer" className="font-extrabold text-brand-blue hover:underline">📷 View</a> : l.method === "kiosk_pin" ? <span className="text-ink-soft/60">uploading…</span> : <span className="text-ink-soft/50">-</span>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}

function PinSetup({ mySet, onDone }: { mySet: boolean; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    if (!/^\d{6}$/.test(pin)) { setErr("PIN must be 6 digits."); return; }
    if (pin !== confirm) { setErr("PINs don't match."); return; }
    setBusy(true); setErr(null);
    const r = await setClockInPin({ pin });
    setBusy(false);
    if ("error" in r) { setErr(r.error); return; }
    onDone();
  }
  return (
    <div className="rounded-2xl border border-border-soft bg-white p-4">
      <h3 className="mb-1 font-display text-[14px] font-semibold">{mySet ? "Change" : "Set"} your clock-in PIN</h3>
      <p className="mb-3 text-[11px] text-ink-soft">Used at the terminal when your phone is dead. Keep it secret.</p>
      <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">New PIN</span><input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="••••••" className="min-h-10 rounded-[9px] border border-border-soft bg-paper/60 px-3 text-center text-[16px] font-bold tracking-[.3em] outline-none focus:border-brand-blue" /></label>
        <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Confirm</span><input value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="••••••" className="min-h-10 rounded-[9px] border border-border-soft bg-paper/60 px-3 text-center text-[16px] font-bold tracking-[.3em] outline-none focus:border-brand-blue" /></label>
        <button onClick={save} disabled={busy} className="inline-flex min-h-10 items-center justify-center rounded-[10px] bg-brand-blue px-4 text-[13px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-70">{busy ? "Saving…" : "Save PIN"}</button>
      </div>
      {err && <p className="mt-2 text-[12px] font-bold text-[#b3261e]">{err}</p>}
    </div>
  );
}
