"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getMarkableClasses, getStudentAttendance, markStudentAttendance, bulkMarkClass, getStudentAttendanceReport, type MarkableClass, type StudentAttendance, type StudentAttnReportRow } from "@/lib/actions/student-attendance";
import { exportReport } from "@/lib/export-report";

const ALL_CLASSES = "__all__"; // whole-school scope; mirrors the sentinel in student-attendance.ts
const STATUS_BADGE: Record<string, string> = { Present: "bg-brand-green/10 text-brand-green", Late: "bg-[#fdf6e9] text-[#b9540f]", Absent: "bg-[#fdeeee] text-[#b3261e]", "Not required": "bg-paper text-ink-soft" };

function weekRange(dateStr: string): [string, string] {
  const d = new Date(dateStr + "T00:00"); const dow = (d.getDay() + 6) % 7;
  const mon = new Date(d.getTime() - dow * 864e5); const sun = new Date(mon.getTime() + 6 * 864e5);
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return [iso(mon), iso(sun)];
}

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const STATUSES = [["present", "P", "bg-brand-green text-white", "Present"], ["absent", "A", "bg-[#e5484d] text-white", "Absent"], ["late", "L", "bg-[#f4b740] text-white", "Late"]] as const;

export function StudentAttendanceView({ embedded }: { embedded?: boolean }) {
  const [classes, setClasses] = useState<MarkableClass[]>([]);
  const [className, setClassName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [data, setData] = useState<StudentAttendance | null>(null);
  const [allRows, setAllRows] = useState<StudentAttnReportRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getMarkableClasses().then((cs) => { setClasses(cs); setClassName((cur) => cur || cs[0]?.className || ""); }); }, []);

  const allScope = className === ALL_CLASSES;
  const load = useCallback(async () => {
    setErr(null);
    if (!className) { setData(null); setAllRows(null); return; }
    if (className === ALL_CLASSES) { // whole-school read-only view for the selected day
      setData(null); setAllRows(null);
      const r = await getStudentAttendanceReport(ALL_CLASSES, date, date);
      if ("error" in r) setErr(r.error); else setAllRows(r);
      return;
    }
    setAllRows(null);
    const r = await getStudentAttendance(className, date);
    if ("error" in r) { setErr(r.error); setData(null); } else setData(r);
  }, [className, date]);
  useEffect(() => { load(); }, [load]);

  // Group the whole-school rows by class with per-class and overall tallies.
  const allGroups = useMemo(() => {
    if (!allRows) return [];
    const m = new Map<string, StudentAttnReportRow[]>();
    for (const r of allRows) { const g = m.get(r.className) ?? (m.set(r.className, []), m.get(r.className)!); g.push(r); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([cn, rows]) => {
      const n = (label: string) => rows.filter((r) => r.status === label).length;
      return { className: cn, rows, present: n("Present"), late: n("Late"), absent: n("Absent"), notReq: n("Not required"), unmarked: rows.filter((r) => r.status === "—").length };
    });
  }, [allRows]);
  const allTotals = useMemo(() => allGroups.reduce((t, g) => ({ present: t.present + g.present + g.late, absent: t.absent + g.absent, unmarked: t.unmarked + g.unmarked }), { present: 0, absent: 0, unmarked: 0 }), [allGroups]);

  async function mark(studentId: string, status: "present" | "absent" | "late") {
    setData((d) => d ? { ...d, rows: d.rows.map((r) => r.id === studentId ? { ...r, status } : r) } : d); // optimistic
    const r = await markStudentAttendance({ studentId, className, date, status });
    if ("error" in r) { setErr(r.error); load(); } else load();
  }
  async function bulk(mode: "present" | "absent" | "excused" | "clear") {
    if (mode === "excused" && !confirm(`Mark ${className} as "not required" for ${date}? (e.g. holiday / no class)`)) return;
    setBusy(true); setErr(null);
    const r = await bulkMarkClass({ className, date, mode });
    setBusy(false);
    if ("error" in r) setErr(r.error); else load();
  }
  async function runExport(format: "pdf" | "excel" | "csv", period: "day" | "week") {
    if (!className) return;
    const [from, to] = period === "week" ? weekRange(date) : [date, date];
    setBusy(true); setErr(null);
    const r = await getStudentAttendanceReport(className, from, to);
    setBusy(false);
    if ("error" in r) { setErr(r.error); return; }
    const multiDay = from !== to;
    const columns = [
      ...(multiDay ? [{ key: "date", label: "Date" }] : []),
      { key: "name", label: "Student" },
      ...(allScope ? [{ key: "className", label: "Class" }] : []), // class column only meaningful across classes
      { key: "admissionNo", label: "Admission ID" }, { key: "status", label: "Status" },
    ];
    const scope = allScope ? "all-classes" : className;
    exportReport(format, { title: allScope ? "Whole-school attendance" : `${className} attendance`, subtitle: multiDay ? `${from} → ${to}` : from, columns, rows: r, filename: `attendance-${scope}-${from}${multiDay ? `_${to}` : ""}` });
  }

  return (
    <>
      {!embedded && <div className="mb-5"><h1 className="font-display text-[clamp(21px,3.5vw,28px)] font-semibold leading-tight">Attendance</h1><p className="mt-0.5 text-[13px] text-ink-soft">Mark students present or absent for the day.</p></div>}

      <div className="mb-4 flex flex-wrap items-end gap-2.5 rounded-2xl border border-border-soft bg-white p-3.5">
        <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Class</span>
          <select value={className} onChange={(e) => setClassName(e.target.value)} disabled={classes.length <= 1} className="min-h-9 rounded-[9px] border border-border-soft bg-paper/60 px-2.5 text-[12px] font-bold outline-none focus:border-brand-blue disabled:opacity-70">{classes.length === 0 ? <option value="">No class</option> : <>{classes.length > 1 && <option value={ALL_CLASSES}>All classes</option>}{classes.map((c) => <option key={c.className} value={c.className}>{c.className}{c.mine ? " (my class)" : ""}</option>)}</>}</select>
        </label>
        <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Date</span><input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className="min-h-9 rounded-[9px] border border-border-soft bg-paper/60 px-2.5 text-[12px] outline-none focus:border-brand-blue" /></label>
        {data?.canMark && data.rows.length > 0 && <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => bulk("present")} disabled={busy} className="inline-flex min-h-9 items-center rounded-[10px] border border-brand-green/30 bg-brand-green/10 px-3 text-[12px] font-extrabold text-brand-green transition hover:bg-brand-green/20 disabled:opacity-60">All present</button>
          <button onClick={() => bulk("absent")} disabled={busy} className="inline-flex min-h-9 items-center rounded-[10px] border border-[#f3c2c2] bg-[#fdeeee] px-3 text-[12px] font-extrabold text-[#b3261e] transition hover:bg-[#fbe3e3] disabled:opacity-60">All absent</button>
          <button onClick={() => bulk("excused")} disabled={busy} className="inline-flex min-h-9 items-center rounded-[10px] border border-border-soft bg-white px-3 text-[12px] font-extrabold text-ink-soft transition hover:border-brand-blue disabled:opacity-60">Not required</button>
          {data.marked > 0 && <button onClick={() => bulk("clear")} disabled={busy} className="inline-flex min-h-9 items-center rounded-[10px] px-2 text-[12px] font-extrabold text-ink-soft underline transition hover:text-ink disabled:opacity-60">Clear</button>}
        </div>}
        {className && <details className="relative ml-auto">
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-[10px] border border-border-soft bg-white px-3 text-[12px] font-extrabold text-ink transition hover:border-brand-blue hover:text-brand-blue">⤓ Download</summary>
          <div className="absolute right-0 z-20 mt-1.5 w-56 rounded-xl border border-border-soft bg-white p-1.5 shadow-lg">
            <p className="rounded-md bg-paper px-2 py-1.5 text-[11px] font-extrabold text-ink">{allScope ? "🏫 All classes" : className}</p>
            <p className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">This day ({date})</p>
            <button onClick={() => runExport("pdf", "day")} className="block w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-bold hover:bg-paper">PDF</button>
            <button onClick={() => runExport("excel", "day")} className="block w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-bold hover:bg-paper">Excel</button>
            <p className="mt-1 border-t border-border-soft px-2 pt-1.5 pb-1 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">This week</p>
            <button onClick={() => runExport("pdf", "week")} className="block w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-bold hover:bg-paper">PDF</button>
            <button onClick={() => runExport("excel", "week")} className="block w-full rounded-lg px-2 py-1.5 text-left text-[12px] font-bold hover:bg-paper">Excel</button>
          </div>
        </details>}
        {data && <div className="flex flex-wrap gap-3 text-[11px] font-bold"><span className="text-brand-green">{data.present} present</span><span className="text-[#b3261e]">{data.absent} absent</span><span className="text-ink-soft">{data.rows.length - data.marked} unmarked</span></div>}
        {allScope && allRows && <div className="flex flex-wrap gap-3 text-[11px] font-bold"><span className="text-brand-green">{allTotals.present} present</span><span className="text-[#b3261e]">{allTotals.absent} absent</span><span className="text-ink-soft">{allTotals.unmarked} unmarked</span><span className="text-ink-soft/70">· {allRows.length} students</span></div>}
      </div>

      {err && <div className="mb-4 rounded-[10px] border border-[#f3c2c2] bg-[#fdeeee] px-3 py-2 text-[12px] font-bold text-[#b3261e]">{err}</div>}

      <section className="rounded-2xl border border-border-soft bg-white p-4 sm:p-5">
        {!className ? <p className="text-[12px] text-ink-soft">No class to mark. {classes.length === 0 ? "You aren't assigned a class." : ""}</p>
          : allScope ? (
              !allRows ? <p className="text-[12px] text-ink-soft">Loading whole-school records…</p>
              : allRows.length === 0 ? <div className="grid place-items-center rounded-xl border border-dashed border-border-soft py-10 text-center text-[12px] text-ink-soft">No students yet.</div>
              : <div className="grid gap-4">
                  <p className="text-[11px] text-ink-soft">Read-only view of every class for <strong className="text-ink">{date}</strong>. To change marks, pick a specific class above. Use <strong className="text-ink">⤓ Download</strong> for a day/week report.</p>
                  {allGroups.map((g) => (
                    <div key={g.className}>
                      <div className="mb-1.5 flex flex-wrap items-center gap-2 border-b border-border-soft pb-1.5">
                        <h3 className="text-[13px] font-extrabold text-ink">{g.className || "Unassigned"}</h3>
                        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                          {g.present > 0 && <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-brand-green">{g.present} present</span>}
                          {g.late > 0 && <span className="rounded-full bg-[#fdf6e9] px-2 py-0.5 text-[#b9540f]">{g.late} late</span>}
                          {g.absent > 0 && <span className="rounded-full bg-[#fdeeee] px-2 py-0.5 text-[#b3261e]">{g.absent} absent</span>}
                          {g.notReq > 0 && <span className="rounded-full bg-paper px-2 py-0.5 text-ink-soft">{g.notReq} not required</span>}
                          {g.unmarked > 0 && <span className="rounded-full bg-paper px-2 py-0.5 text-ink-soft/70">{g.unmarked} unmarked</span>}
                        </div>
                      </div>
                      <ul className="grid gap-1.5 sm:grid-cols-2">{g.rows.map((r, i) => (
                        <li key={r.admissionNo + i} className="flex items-center justify-between gap-3 rounded-xl border border-border-soft px-3 py-2">
                          <div className="min-w-0"><div className="truncate text-[13px] font-bold text-ink">{r.name}</div><code className="text-[10px] text-ink-soft">{r.admissionNo}</code></div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${STATUS_BADGE[r.status] ?? "bg-paper text-ink-soft/70"}`}>{r.status}</span>
                        </li>
                      ))}</ul>
                    </div>
                  ))}
                </div>
            )
          : !data ? <p className="text-[12px] text-ink-soft">Loading…</p>
          : data.rows.length === 0 ? <div className="grid place-items-center rounded-xl border border-dashed border-border-soft py-10 text-center text-[12px] text-ink-soft">No students in {className} yet.</div>
          : <ul className="grid gap-1.5">{data.rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-soft px-3 py-2">
                <div className="min-w-0"><div className="truncate text-[13px] font-bold text-ink">{r.name}</div><code className="text-[10px] text-ink-soft">{r.admissionNo}</code></div>
                {data.canMark ? <div className="flex shrink-0 gap-1">{STATUSES.map(([s, ltr, on, title]) => <button key={s} title={title} onClick={() => mark(r.id, s)} className={`grid size-8 place-items-center rounded-lg text-[12px] font-extrabold transition ${r.status === s ? on : "bg-paper text-ink-soft hover:bg-border-soft"}`}>{ltr}</button>)}</div>
                  : <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${r.status === "present" || r.status === "late" ? "bg-brand-green/10 text-brand-green" : r.status === "absent" ? "bg-[#fdeeee] text-[#b3261e]" : "bg-paper text-ink-soft"}`}>{r.status ? r.status[0].toUpperCase() + r.status.slice(1) : "—"}</span>}
              </li>
            ))}</ul>}
      </section>
    </>
  );
}
