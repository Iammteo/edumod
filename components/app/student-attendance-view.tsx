"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getMarkableClasses, getStudentAttendance, markStudentAttendance, bulkMarkClass, getStudentAttendanceReport, getAttendanceAnalytics, type MarkableClass, type StudentAttendance, type StudentAttnReportRow, type AttendanceAnalytics } from "@/lib/actions/student-attendance";
import { exportReport } from "@/lib/export-report";

const ALL_CLASSES = "__all__";
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const monthStartIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };
const PER_PAGE = 7;

const Icon = (p: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-4">{p}</svg>;
const I_CHECK = <path d="M20 6 9 17l-5-5" />;
const I_X = <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>;
const I_CLOCK = <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>;
const I_SHIELD = <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
const I_USERS = <><path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" /><circle cx="9" cy="7" r="3" /><path d="M22 19v-1a4 4 0 0 0-3-3.87" /></>;
const I_HELP = <><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></>;

const STATUS_BTN = [
  { key: "present", label: "Present", icon: I_CHECK, on: "border-brand-green/40 bg-brand-green/10 text-brand-green" },
  { key: "absent", label: "Absent", icon: I_X, on: "border-[#f3c2c2] bg-[#fdeeee] text-[#b3261e]" },
  { key: "late", label: "Late", icon: I_CLOCK, on: "border-[#f3d9a8] bg-[#fdf6e9] text-[#b9540f]" },
  { key: "excused", label: "Excused", icon: I_SHIELD, on: "border-[#dccdf0] bg-[#f0e9fa] text-[#6b2fb3]" },
] as const;
type Status = "present" | "absent" | "late" | "excused";
type CountsLite = { total: number; present: number; absent: number; late: number; excused: number; unmarked: number };
const ZERO: CountsLite = { total: 0, present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
const SUMMARY_SEGS: { key: keyof CountsLite; label: string; color: string }[] = [
  { key: "present", label: "Present", color: "#178a4c" },
  { key: "absent", label: "Absent", color: "#e5484d" },
  { key: "late", label: "Late", color: "#f4b740" },
  { key: "excused", label: "Excused", color: "#6b2fb3" },
  { key: "unmarked", label: "Unmarked", color: "#cdd7e6" },
];

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const init = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return <span className="grid shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-blue" style={{ width: size, height: size, fontSize: size * 0.38 }}>{init}</span>;
}
function RateDonut({ value, size = 88, color = "#178a4c" }: { value: number; size?: number; color?: string }) {
  return (
    <div className="relative grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: `conic-gradient(${color} ${value * 3.6}deg, #e9eef5 0deg)` }}>
      <div className="grid place-items-center rounded-full bg-white" style={{ width: size - 18, height: size - 18 }}><span className="font-display font-bold text-ink" style={{ fontSize: size * 0.2 }}>{value}%</span></div>
    </div>
  );
}
function SummaryDonut({ counts, size = 120 }: { counts: CountsLite; size?: number }) {
  const total = counts.total || 1;
  let acc = 0;
  const stops = SUMMARY_SEGS.map((s) => { const start = (acc / total) * 360; acc += counts[s.key]; const end = (acc / total) * 360; return `${s.color} ${start}deg ${end}deg`; }).join(", ");
  return (
    <div className="relative grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: counts.total ? `conic-gradient(${stops})` : "#e9eef5" }}>
      <div className="grid place-items-center rounded-full bg-white text-center" style={{ width: size - 30, height: size - 30 }}><div><div className="font-display text-[20px] font-bold leading-none text-ink">{counts.total}</div><div className="text-[10px] text-ink-soft">Students</div></div></div>
    </div>
  );
}
function WeekChart({ data }: { data: { label: string; rate: number }[] }) {
  const w = 280, h = 96, pad = 10;
  const n = Math.max(1, data.length - 1);
  const pts = data.map((d, i) => [pad + i * ((w - 2 * pad) / n), h - pad - (d.rate / 100) * (h - 2 * pad)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1]?.[0] ?? pad},${h - pad} L${pts[0]?.[0] ?? pad},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h + 16}`} className="w-full">
      {[0, 0.5, 1].map((g) => <line key={g} x1={pad} x2={w - pad} y1={pad + g * (h - 2 * pad)} y2={pad + g * (h - 2 * pad)} stroke="#eef2f9" strokeWidth="1" />)}
      <path d={area} fill="#178a4c" opacity="0.08" />
      <path d={line} fill="none" stroke="#178a4c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#fff" stroke="#178a4c" strokeWidth="2" />)}
      {data.map((d, i) => <text key={i} x={pts[i][0]} y={h + 10} textAnchor="middle" className="fill-ink-soft text-[9px]">{d.label}</text>)}
    </svg>
  );
}

export function StudentAttendanceView({ embedded }: { embedded?: boolean }) {
  const [classes, setClasses] = useState<MarkableClass[]>([]);
  const [picked, setPicked] = useState("");
  const [scope, setScope] = useState<"single" | "all">("single");
  const [date, setDate] = useState(todayIso());
  const [data, setData] = useState<StudentAttendance | null>(null);
  const [allRows, setAllRows] = useState<StudentAttnReportRow[] | null>(null);
  const [analytics, setAnalytics] = useState<AttendanceAnalytics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [dl, setDl] = useState(false);
  const [dlFrom, setDlFrom] = useState(monthStartIso());
  const [dlTo, setDlTo] = useState(todayIso());

  const className = scope === "all" ? ALL_CLASSES : picked;
  const allScope = scope === "all";
  const canSeeAll = classes.length > 1;

  useEffect(() => { getMarkableClasses().then((cs) => { setClasses(cs); setPicked((cur) => cur || cs[0]?.className || ""); }); }, []);

  const load = useCallback(async () => {
    setErr(null);
    if (allScope) { setData(null); setAllRows(null); const r = await getStudentAttendanceReport(ALL_CLASSES, date, date); if ("error" in r) setErr(r.error); else setAllRows(r); return; }
    if (!picked) { setData(null); return; }
    setAllRows(null);
    const r = await getStudentAttendance(picked, date);
    if ("error" in r) { setErr(r.error); setData(null); } else setData(r);
  }, [allScope, picked, date]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (picked) getAttendanceAnalytics(picked, date).then(setAnalytics); }, [picked, date]);
  useEffect(() => { setPage(1); }, [picked, date, scope, q]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 3500); return () => clearTimeout(t); }, [notice]);

  // Whole-school groups (All classes view) with per-class tallies.
  const allGroups = useMemo(() => {
    if (!allRows) return [];
    const m = new Map<string, StudentAttnReportRow[]>();
    for (const r of allRows) { const g = m.get(r.className) ?? (m.set(r.className, []), m.get(r.className)!); g.push(r); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([cn, rows]) => {
      const nn = (l: string) => rows.filter((r) => r.status === l).length;
      return { className: cn, total: rows.length, present: nn("Present"), late: nn("Late"), absent: nn("Absent"), excused: nn("Not required"), unmarked: rows.filter((r) => r.status === "-").length };
    });
  }, [allRows]);

  const filtered = useMemo(() => (data?.rows ?? []).filter((r) => `${r.name} ${r.admissionNo}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const slice = filtered.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);

  async function mark(studentId: string, status: Status) {
    setData((d) => d ? { ...d, rows: d.rows.map((r) => r.id === studentId ? { ...r, status } : r) } : d);
    const r = await markStudentAttendance({ studentId, className: picked, date, status });
    if ("error" in r) { setErr(r.error); load(); } else load();
  }
  async function bulk(mode: "present" | "absent" | "excused" | "clear") {
    if (mode === "excused" && !confirm(`Mark ${picked} as "not required" for ${date}? (e.g. holiday / no class)`)) return;
    setBusy(true); setErr(null);
    const r = await bulkMarkClass({ className: picked, date, mode });
    setBusy(false);
    if ("error" in r) setErr(r.error); else load();
  }
  async function runExport(format: "pdf" | "excel" | "csv") {
    if (dlFrom > dlTo) { setErr("The “From” date must be on or before the “To” date."); return; }
    const from = dlFrom, to = dlTo;
    const r = await getStudentAttendanceReport(className, from, to);
    if ("error" in r) { setErr(r.error); return; }
    const multiDay = from !== to;
    const columns = [...(multiDay ? [{ key: "date", label: "Date" }] : []), { key: "name", label: "Student" }, ...(allScope ? [{ key: "className", label: "Class" }] : []), { key: "admissionNo", label: "Admission ID" }, { key: "status", label: "Status" }];
    const agg = new Map<string, { name: string; className: string; admissionNo: string; present: number; late: number; absent: number; notReq: number }>();
    for (const row of r) { const k = `${row.className}|${row.admissionNo}|${row.name}`; const s = agg.get(k) ?? { name: row.name, className: row.className, admissionNo: row.admissionNo, present: 0, late: 0, absent: 0, notReq: 0 }; if (row.status === "Present") s.present++; else if (row.status === "Late") s.late++; else if (row.status === "Absent") s.absent++; else if (row.status === "Not required") s.notReq++; agg.set(k, s); }
    const summary = { title: `Summary per student (${from} → ${to})`, columns: [{ key: "name", label: "Student" }, ...(allScope ? [{ key: "className", label: "Class" }] : []), { key: "admissionNo", label: "Admission ID" }, { key: "present", label: "Present" }, { key: "late", label: "Late" }, { key: "absent", label: "Absent" }, { key: "notReq", label: "Not required" }], rows: [...agg.values()].sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name)) };
    const sc = allScope ? "all-classes" : picked;
    exportReport(format, { title: allScope ? "Whole-school attendance" : `${picked} attendance`, subtitle: multiDay ? `${from} → ${to}` : from, columns, rows: r, filename: `attendance-${sc}-${from}${multiDay ? `_${to}` : ""}`, summary });
    setDl(false);
  }

  const counts: CountsLite = allScope
    ? allGroups.reduce((t, g) => ({ total: t.total + g.total, present: t.present + g.present, absent: t.absent + g.absent, late: t.late + g.late, excused: t.excused + g.excused, unmarked: t.unmarked + g.unmarked }), { ...ZERO })
    : data?.counts ?? ZERO;
  const total = counts.total || 0;
  const pct = (n: number) => (total ? `${((n / total) * 100).toFixed(1)}%` : "0%");
  const rate = total ? Math.round((counts.present / total) * 100) : 0;
  const totalSub = allScope ? `across ${allGroups.length} class${allGroups.length === 1 ? "" : "es"}` : (picked ? `in ${picked}` : "");
  const statCards = [
    { label: "Total students", value: total, sub: totalSub, color: "#5b6b86", bg: "#eef2f9", icon: I_USERS },
    { label: "Present", value: counts.present, sub: pct(counts.present), color: "#178a4c", bg: "#e7f6ee", icon: I_CHECK },
    { label: "Absent", value: counts.absent, sub: pct(counts.absent), color: "#e5484d", bg: "#fdeeee", icon: I_X },
    { label: "Late", value: counts.late, sub: pct(counts.late), color: "#b9540f", bg: "#fdf6e9", icon: I_CLOCK },
    { label: "Unmarked", value: counts.unmarked, sub: pct(counts.unmarked), color: "#6b2fb3", bg: "#f0e9fa", icon: I_HELP },
  ];

  const statRow = (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {statCards.map((s) => <div key={s.label} className="rounded-2xl border border-border-soft bg-white p-4"><span className="grid size-10 place-items-center rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{Icon(s.icon)}</span><div className="mt-2.5 font-display text-[24px] font-bold leading-none text-ink">{s.value}</div><div className="mt-1 text-[11px] font-bold text-ink-soft">{s.label}</div>{s.sub && <div className="text-[10px] font-extrabold" style={{ color: s.color }}>{s.sub}</div>}</div>)}
    </div>
  );

  const rightRail = (
    <div className="grid content-start gap-4">
      {!allScope && <section className="rounded-2xl border border-border-soft bg-white p-4"><div className="mb-2 flex items-center justify-between"><h3 className="font-display text-[14px] font-semibold">Week overview</h3><span className="text-[10px] font-bold text-ink-soft">This week</span></div>{analytics ? <WeekChart data={analytics.week} /> : <div className="h-24" />}</section>}
      <section className="rounded-2xl border border-border-soft bg-white p-4">
        <h3 className="mb-3 font-display text-[14px] font-semibold">Today&rsquo;s summary</h3>
        <div className="flex items-center gap-4"><SummaryDonut counts={counts} /><ul className="grid flex-1 gap-1.5 text-[11px]">{SUMMARY_SEGS.map((s) => <li key={s.key} className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 font-bold text-ink"><span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />{s.label}</span><span className="font-bold text-ink-soft">{counts[s.key]} ({pct(counts[s.key])})</span></li>)}</ul></div>
        {analytics && analytics.byClass.length > 0 && <div className="mt-4 border-t border-border-soft pt-3"><div className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">By class</div><ul className="grid gap-2">{analytics.byClass.slice(0, 8).map((c) => <li key={c.className} className="grid grid-cols-[64px_1fr_30px] items-center gap-2 text-[11px]"><span className="truncate font-bold text-ink">{c.className}</span><span className="h-2 overflow-hidden rounded-full bg-paper"><span className="block h-full rounded-full bg-brand-green" style={{ width: `${c.rate}%` }} /></span><span className="text-right font-bold text-ink-soft">{c.rate}%</span></li>)}</ul></div>}
      </section>
      <section className="rounded-2xl border border-border-soft bg-white p-4"><h3 className="mb-3 font-display text-[14px] font-semibold">Recent activity</h3>{!analytics || analytics.recent.length === 0 ? <p className="text-[11px] text-ink-soft">No recent attendance activity.</p> : <ul className="grid gap-2.5">{analytics.recent.map((a, i) => <li key={i} className="flex items-start gap-2.5"><span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${a.kind === "cleared" ? "bg-[#fdeeee] text-[#b3261e]" : "bg-brand-green/10 text-brand-green"}`}>{Icon(I_CHECK)}</span><div className="min-w-0 flex-1"><div className="text-[11px] font-bold text-ink">{a.text}</div><div className="text-[10px] text-ink-soft">{a.time}</div></div></li>)}</ul>}</section>
    </div>
  );

  return (
    <>
      {!embedded && <div className="mb-5"><h1 className="font-display text-[clamp(21px,3.5vw,28px)] font-semibold leading-tight">Attendance</h1><p className="mt-0.5 text-[13px] text-ink-soft">Mark students present, absent, late or excused for the day.</p></div>}

      {/* Filter / control bar */}
      <div className="mb-4 flex flex-wrap items-end gap-2.5 rounded-2xl border border-border-soft bg-white p-3.5">
        <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Select class</span>
          <select value={picked} onChange={(e) => { setPicked(e.target.value); setScope("single"); }} disabled={classes.length === 0} className="min-h-9 rounded-[9px] border border-border-soft bg-paper/60 px-2.5 text-[12px] font-bold outline-none focus:border-brand-blue disabled:opacity-70">{classes.length === 0 ? <option value="">No class</option> : classes.map((c) => <option key={c.className} value={c.className}>{c.className}{c.mine ? " (my class)" : ""}</option>)}</select>
        </label>
        <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Date</span><input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className="min-h-9 rounded-[9px] border border-border-soft bg-paper/60 px-2.5 text-[12px] outline-none focus:border-brand-blue" /></label>
        {canSeeAll && <div className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">View</span>
          <div className="inline-flex rounded-[10px] border border-border-soft p-0.5">{(["all", "single"] as const).map((s) => <button key={s} onClick={() => setScope(s)} className={`rounded-[8px] px-3 py-1.5 text-[12px] font-extrabold transition ${scope === s ? "bg-brand-blue text-white" : "text-ink-soft hover:text-brand-blue"}`}>{s === "all" ? "All classes" : "Single class"}</button>)}</div>
        </div>}
        {!allScope && <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Search</span><div className="flex min-h-9 items-center gap-1.5 rounded-[9px] border border-border-soft bg-paper/60 px-2.5"><span className="text-ink-soft">{Icon(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>)}</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student…" className="min-w-[120px] flex-1 bg-transparent text-[12px] outline-none" /></div></label>}
        <div className="ml-auto flex items-end gap-2">
          <div className="relative"><button onClick={() => setDl((v) => !v)} className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-border-soft bg-white px-3.5 text-[12px] font-extrabold text-ink transition hover:border-brand-blue hover:text-brand-blue">{Icon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></>)} Download report</button>
            {dl && <><div className="fixed inset-0 z-30" onClick={() => setDl(false)} /><div className="absolute right-0 z-40 mt-1.5 w-60 rounded-xl border border-border-soft bg-white p-1.5 shadow-lg">
              <p className="rounded-md bg-paper px-2 py-1.5 text-[11px] font-extrabold text-ink">{allScope ? "🏫 All classes" : picked}</p>
              <div className="my-1.5 grid grid-cols-2 gap-2"><label className="grid gap-1"><span className="px-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">From</span><input type="date" value={dlFrom} max={dlTo} onChange={(e) => setDlFrom(e.target.value)} className="min-h-9 rounded-[9px] border border-border-soft bg-paper/60 px-2 text-[12px] outline-none focus:border-brand-blue" /></label><label className="grid gap-1"><span className="px-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">To</span><input type="date" value={dlTo} min={dlFrom} max={todayIso()} onChange={(e) => setDlTo(e.target.value)} className="min-h-9 rounded-[9px] border border-border-soft bg-paper/60 px-2 text-[12px] outline-none focus:border-brand-blue" /></label></div>
              <button onClick={() => runExport("pdf")} className="block w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-bold hover:bg-paper">PDF</button>
              <button onClick={() => runExport("excel")} className="block w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-bold hover:bg-paper">Excel</button>
              <button onClick={() => runExport("csv")} className="block w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-bold hover:bg-paper">CSV</button>
            </div></>}
          </div>
          <button onClick={() => setNotice("Absence alerts are coming soon — guardians will be notified by SMS/email.")} className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] bg-brand-blue px-3.5 text-[12px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark">{Icon(<><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>)} Send absence alert</button>
        </div>
      </div>

      {err && <div className="mb-4 rounded-[10px] border border-[#f3c2c2] bg-[#fdeeee] px-3 py-2 text-[12px] font-bold text-[#b3261e]">{err}</div>}
      {notice && <div className="mb-4 rounded-[10px] border border-brand-soft bg-brand-soft/40 px-3 py-2 text-[12px] font-bold text-brand-blue">{notice}</div>}

      {(() => {
        if (allScope) {
          if (!allRows) return <p className="text-[12px] text-ink-soft">Loading whole-school records…</p>;
          if (allRows.length === 0) return <div className="grid place-items-center rounded-2xl border border-dashed border-border-soft bg-white py-12 text-center text-[12px] text-ink-soft">No students yet.</div>;
        } else {
          if (!picked) return <div className="grid place-items-center rounded-2xl border border-dashed border-border-soft bg-white py-12 text-center text-[12px] text-ink-soft">{classes.length === 0 ? "You aren't assigned a class." : "Select a class to begin."}</div>;
          if (!data) return <p className="text-[12px] text-ink-soft">Loading…</p>;
        }
        return (
          <>
            {statRow}
            <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
              {allScope ? (
                <div className="min-w-0">
                  <p className="mb-3 text-[11px] text-ink-soft">Whole-school attendance for <strong className="text-ink">{date}</strong>. Tap a class to open and edit it.</p>
                  <div className="grid content-start gap-3 sm:grid-cols-2">{allGroups.map((g) => { const r = g.total ? Math.round((g.present / g.total) * 100) : 0; return (
                    <button key={g.className} onClick={() => { setPicked(g.className); setScope("single"); }} className="rounded-2xl border border-border-soft bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(16,33,63,.08)]">
                      <div className="flex items-center justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-display text-[15px] font-semibold text-ink">{g.className || "Unassigned"}</h3><div className="mt-0.5 text-[11px] text-ink-soft">{g.present}/{g.total} present</div></div><RateDonut value={r} size={56} /></div>
                      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold">{g.present > 0 && <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-brand-green">{g.present} present</span>}{g.late > 0 && <span className="rounded-full bg-[#fdf6e9] px-2 py-0.5 text-[#b9540f]">{g.late} late</span>}{g.absent > 0 && <span className="rounded-full bg-[#fdeeee] px-2 py-0.5 text-[#b3261e]">{g.absent} absent</span>}{g.excused > 0 && <span className="rounded-full bg-[#f0e9fa] px-2 py-0.5 text-[#6b2fb3]">{g.excused} excused</span>}{g.unmarked > 0 && <span className="rounded-full bg-paper px-2 py-0.5 text-ink-soft/70">{g.unmarked} unmarked</span>}</div>
                    </button>
                  ); })}</div>
                </div>
              ) : (
                <section className="min-w-0 rounded-2xl border border-border-soft bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center gap-2"><h2 className="font-display text-[16px] font-semibold">{picked} attendance</h2>{date === todayIso() && <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-extrabold text-brand-green">Today</span>}</div>
                  <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-border-soft bg-paper/40 p-4">
                    <div className="flex items-center gap-3"><RateDonut value={rate} /><div><div className="text-[11px] font-bold text-ink-soft">Attendance rate</div><div className="text-[12px] text-ink-soft">{counts.present}/{total} present</div></div></div>
                    <div className="flex items-center gap-2.5"><Avatar name={data?.teacher?.name ?? "Class Teacher"} size={40} /><div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Class teacher</div><div className="text-[13px] font-bold text-ink">{data?.teacher?.name ?? "Not assigned"}</div><button onClick={() => setNotice("Messaging is coming soon (Communications).")} className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-extrabold text-brand-blue hover:underline">{Icon(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />)} Message</button></div></div>
                    <div className="ml-auto flex flex-wrap gap-1.5 self-start text-[10px] font-extrabold">{data?.canMark && filtered.length > 0 && <>
                      <button onClick={() => bulk("present")} disabled={busy} className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-1 text-brand-green disabled:opacity-60">All present</button>
                      <button onClick={() => bulk("absent")} disabled={busy} className="rounded-full border border-[#f3c2c2] bg-[#fdeeee] px-2.5 py-1 text-[#b3261e] disabled:opacity-60">All absent</button>
                      <button onClick={() => bulk("excused")} disabled={busy} className="rounded-full border border-border-soft bg-white px-2.5 py-1 text-ink-soft disabled:opacity-60">Not required</button>
                      {data!.marked > 0 && <button onClick={() => bulk("clear")} disabled={busy} className="rounded-full px-2 py-1 text-ink-soft underline disabled:opacity-60">Clear</button>}
                    </>}</div>
                  </div>
                  {filtered.length === 0 ? <div className="grid place-items-center rounded-xl border border-dashed border-border-soft py-10 text-center text-[12px] text-ink-soft">{data!.rows.length === 0 ? `No students in ${picked} yet.` : "No students match your search."}</div>
                    : <>
                      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[12px]">
                        <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="py-2 font-bold">Student</th><th className="py-2 font-bold">Admission No.</th><th className="py-2 font-bold">Guardian</th><th className="py-2 text-right font-bold">Status</th></tr></thead>
                        <tbody>{slice.map((r) => (
                          <tr key={r.id} className="border-b border-border-soft last:border-0">
                            <td className="py-2.5"><div className="flex items-center gap-2.5"><Avatar name={r.name} size={32} /><span className="font-bold text-ink">{r.name}</span></div></td>
                            <td className="py-2.5 text-ink-soft">{r.admissionNo}</td>
                            <td className="py-2.5 text-ink-soft">{r.guardianPhone || "—"}</td>
                            <td className="py-2.5"><div className="flex justify-end gap-1.5">{STATUS_BTN.map((s) => { const active = r.status === s.key; return <button key={s.key} disabled={!data!.canMark} onClick={() => mark(r.id, s.key)} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-extrabold transition disabled:cursor-default ${active ? s.on : "border-border-soft text-ink-soft hover:bg-paper disabled:hover:bg-transparent"}`}>{Icon(s.icon)}<span className="hidden sm:inline">{s.label}</span></button>; })}</div></td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-soft">
                        <span>Showing {(cur - 1) * PER_PAGE + 1} to {Math.min(cur * PER_PAGE, filtered.length)} of {filtered.length} students</span>
                        {pages > 1 && <div className="flex items-center gap-1"><button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={cur === 1} className="grid size-7 place-items-center rounded-lg border border-border-soft disabled:opacity-40">‹</button>{Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, cur - 3), Math.max(0, cur - 3) + 5).map((p) => <button key={p} onClick={() => setPage(p)} className={`grid size-7 place-items-center rounded-lg border text-[11px] font-bold ${p === cur ? "border-brand-blue bg-brand-blue text-white" : "border-border-soft hover:border-brand-blue"}`}>{p}</button>)}<button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={cur === pages} className="grid size-7 place-items-center rounded-lg border border-border-soft disabled:opacity-40">›</button></div>}
                      </div>
                    </>}
                </section>
              )}
              {rightRail}
            </div>
          </>
        );
      })()}
    </>
  );
}
