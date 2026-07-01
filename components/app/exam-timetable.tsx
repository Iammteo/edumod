"use client";

import { useCallback, useEffect, useState } from "react";
import { getExamTimetable, addExamPaper, deleteExamPaper, EXAM_TYPES, type ExamTimetable, type ExamPaper, type ExamClash } from "@/lib/actions/exam-timetable";
import { listTeacherNames } from "@/lib/actions/timetable";
import { SUBJECTS } from "@/lib/subjects";
import { useClassNames } from "./use-classes";
import { useAcademicTerms } from "./use-terms";
import { exportReport } from "@/lib/export-report";
import { Button } from "./ui";

const DURATIONS = [{ label: "30 min", v: 30 }, { label: "45 min", v: 45 }, { label: "1 hr", v: 60 }, { label: "1 hr 30 min", v: 90 }, { label: "2 hrs", v: 120 }, { label: "2 hrs 30 min", v: 150 }, { label: "3 hrs", v: 180 }];

function addMinutes(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, (h || 0) * 60 + (m || 0) + mins);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function fmtDate(d: string) {
  const dt = new Date(`${d}T00:00:00`);
  return dt.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function ExamTimetableTab() {
  const { terms, current } = useAcademicTerms();
  const classes = useClassNames();
  const [teachers, setTeachers] = useState<string[]>([]);
  const [term, setTerm] = useState("");
  const [data, setData] = useState<ExamTimetable | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!term && current) setTerm(current); }, [current, term]);
  useEffect(() => { listTeacherNames().then(setTeachers); }, []);
  const load = useCallback(() => { if (term) getExamTimetable(term).then(setData); }, [term]);
  useEffect(() => { setData(null); load(); }, [load]);

  const termOptions = [...new Set([term, current, ...terms].filter(Boolean))] as string[];

  // Group papers by date for the schedule view.
  const byDate = new Map<string, ExamPaper[]>();
  for (const p of data?.papers ?? []) (byDate.get(p.examDate) ?? byDate.set(p.examDate, []).get(p.examDate)!).push(p);

  function exportSchedule(format: "pdf" | "word") {
    if (!data?.papers.length) return;
    exportReport(format, {
      title: "Exam timetable",
      subtitle: term,
      columns: [
        { key: "date", label: "Date" }, { key: "time", label: "Time" }, { key: "className", label: "Class" },
        { key: "subject", label: "Subject" }, { key: "examType", label: "Type" }, { key: "room", label: "Room" }, { key: "invigilator", label: "Invigilator" },
      ],
      rows: data.papers.map((p) => ({ date: fmtDate(p.examDate), time: `${p.startTime}–${p.endTime}`, className: p.className, subject: p.subject + (p.isWaec ? " (WAEC)" : ""), examType: p.examType, room: p.room ?? "-", invigilator: p.invigilator ?? "-" })),
      filename: `exam_timetable_${term.replace(/[^a-z0-9]+/gi, "_")}`,
    });
  }

  const s = data?.stats;
  return (
    <div className="grid gap-4">
      {/* Term + stats */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border-soft bg-white p-3.5">
        <label className="grid gap-1"><span className="text-[10.5px] font-extrabold uppercase tracking-wide text-ink-soft">Session / Term</span>
          <select value={term} onChange={(e) => setTerm(e.target.value)} className="min-h-9 rounded-lg border border-border-soft bg-white px-2.5 text-[12.5px] font-bold text-ink outline-none focus:border-brand-blue">{termOptions.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        </label>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" disabled={!data?.papers.length} onClick={() => exportSchedule("pdf")}>⬇ PDF</Button>
          <Button size="sm" variant="secondary" disabled={!data?.papers.length} onClick={() => exportSchedule("word")}>⬇ Word</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Papers scheduled" value={s?.papers ?? 0} meta="Across all classes" color="#2159e8" />
        <Stat label="Exam days" value={s?.examDays ?? 0} meta="Distinct dates" color="#178a4c" />
        <Stat label="Invigilators" value={s?.invigilators ?? 0} meta="Assigned" color="#8b5cf6" />
        <Stat label="Clashes detected" value={s?.clashes ?? 0} meta={s?.clashes ? "Need attention" : "All clear ✓"} color={s?.clashes ? "#c0392b" : "#178a4c"} />
      </div>

      {err && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[12px] font-bold text-danger">{err}</p>}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <AddExamForm term={term} classes={classes} teachers={teachers} onAdded={load} onErr={setErr} />

        <div className="grid min-w-0 content-start gap-4">
          {data && data.clashes.length > 0 && <ClashPanel clashes={data.clashes} />}

          <section className="rounded-2xl border border-border-soft bg-white p-4">
            <h3 className="mb-3 font-display text-[15px] font-bold">Exam schedule</h3>
            {data === null ? <p className="py-6 text-center text-[13px] text-ink-soft">Loading…</p>
              : data.papers.length === 0 ? <p className="rounded-xl border border-dashed border-border-soft bg-paper/40 py-10 text-center text-[13px] text-ink-soft">No papers scheduled for {term || "this term"} yet. Add one on the left.</p>
              : <div className="grid gap-4">
                  {[...byDate.entries()].map(([date, papers]) => (
                    <div key={date}>
                      <p className="mb-2 flex items-center gap-2 text-[12px] font-extrabold text-ink"><span className="grid size-6 place-items-center rounded-lg bg-brand-soft text-[11px] text-brand-blue">📅</span>{fmtDate(date)} <span className="font-bold text-ink-soft">· {papers.length} paper{papers.length === 1 ? "" : "s"}</span></p>
                      <div className="grid gap-2 sm:grid-cols-2">{papers.map((p) => <PaperCard key={p.id} paper={p} clashed={data.clashes.some((c) => c.papers.some((x) => x.subject === p.subject && x.className === p.className) && c.examDate === p.examDate)} onDelete={async () => { const r = await deleteExamPaper(p.id); if ("error" in r) setErr(r.error); else load(); }} />)}</div>
                    </div>
                  ))}
                </div>}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, meta, color }: { label: string; value: number; meta: string; color: string }) {
  return <div className="rounded-2xl border border-border-soft bg-white p-4"><strong className="block font-display text-[26px] font-bold leading-none" style={{ color }}>{value}</strong><small className="mt-1.5 block text-[12px] font-bold text-ink">{label}</small><span className="mt-0.5 block text-[11px] text-ink-soft">{meta}</span></div>;
}

function PaperCard({ paper, clashed, onDelete }: { paper: ExamPaper; clashed: boolean; onDelete: () => void }) {
  return (
    <div className={`group relative rounded-xl border p-3 ${clashed ? "border-danger/40 bg-danger-soft/30" : "border-border-soft bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5"><strong className="text-[13px] text-ink">{paper.subject}</strong>{paper.isWaec && <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase text-brand-blue">WAEC</span>}{clashed && <span className="rounded bg-danger px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase text-white">Clash</span>}</div>
          <p className="mt-0.5 text-[11.5px] font-bold text-ink-soft">{paper.className} · {paper.examType}</p>
          <p className="mt-1 text-[11.5px] text-ink-soft">🕐 {paper.startTime}–{paper.endTime}{paper.room ? ` · 📍 ${paper.room}` : ""}</p>
          {paper.invigilator && <p className="text-[11.5px] text-ink-soft">👤 {paper.invigilator}</p>}
        </div>
        <button onClick={onDelete} title="Remove paper" className="shrink-0 rounded p-1 text-ink-soft/50 transition hover:bg-danger-soft hover:text-danger">✕</button>
      </div>
    </div>
  );
}

function ClashPanel({ clashes }: { clashes: ExamClash[] }) {
  const label = { room: "Room clash", class: "Class double-booked", invigilator: "Invigilator clash" };
  return (
    <section className="rounded-2xl border border-warn-line bg-warn-soft/40 p-4">
      <h3 className="mb-2 flex items-center gap-2 font-display text-[15px] font-bold text-ink">⚠ Clash check <span className="rounded-full bg-warn px-2 py-0.5 text-[11px] font-extrabold text-white">{clashes.length}</span></h3>
      <div className="grid gap-2">
        {clashes.map((c, i) => (
          <div key={i} className="rounded-xl border border-warn-line bg-white p-2.5">
            <div className="mb-1 flex items-center justify-between"><strong className="text-[12.5px] text-ink">{c.name}</strong><span className="rounded-full bg-warn px-2 py-0.5 text-[9.5px] font-extrabold uppercase text-white">{label[c.kind]}</span></div>
            <p className="mb-1 text-[11px] font-semibold text-ink-soft">{fmtDate(c.examDate)} · {c.startTime}–{c.endTime}</p>
            <div className="flex flex-wrap gap-1.5">{c.papers.map((p, j) => <span key={j} className="rounded-lg bg-paper px-2 py-0.5 text-[11px] font-bold text-ink">{p.className} · {p.subject}</span>)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AddExamForm({ term, classes, teachers, onAdded, onErr }: { term: string; classes: string[]; teachers: string[]; onAdded: () => void; onErr: (m: string | null) => void }) {
  const [examType, setExamType] = useState<string>("Terminal Exam");
  const [className, setClassName] = useState("");
  const [subject, setSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState(90);
  const [room, setRoom] = useState("");
  const [invigilator, setInvigilator] = useState("");
  const [isWaec, setIsWaec] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!className && classes.length) setClassName(classes[0]); }, [classes, className]);

  function reset() { setSubject(""); setExamDate(""); setStartTime("09:00"); setDuration(90); setRoom(""); setInvigilator(""); setIsWaec(false); setNotes(""); }
  async function submit() {
    setBusy(true); onErr(null);
    const r = await addExamPaper({ term, examType, className, subject, examDate, startTime, endTime: addMinutes(startTime, duration), room, invigilator, isWaec, notes });
    setBusy(false);
    if ("error" in r) { onErr(r.error); return; }
    reset(); onAdded();
  }

  return (
    <section className="grid content-start gap-2.5 rounded-2xl border border-border-soft bg-white p-4">
      <h3 className="font-display text-[15px] font-bold">Add exam</h3>
      <p className="-mt-1.5 text-[11.5px] text-ink-soft">Create a new exam entry for {term || "the selected term"}.</p>
      <FF label="Exam type"><select value={examType} onChange={(e) => setExamType(e.target.value)} className={inp}>{EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></FF>
      <FF label="Class / Level"><select value={className} onChange={(e) => setClassName(e.target.value)} className={inp}>{classes.map((c) => <option key={c} value={c}>{c}</option>)}</select></FF>
      <FF label="Subject"><input list="exam-subjects" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" className={inp} /><datalist id="exam-subjects">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist></FF>
      <FF label="Paper date"><input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className={inp} /></FF>
      <div className="grid grid-cols-2 gap-2">
        <FF label="Start time"><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inp} /></FF>
        <FF label="Duration"><select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inp}>{DURATIONS.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}</select></FF>
      </div>
      <FF label="Room"><input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Exam Hall 1" className={inp} /></FF>
      <FF label="Invigilator"><input list="exam-invigilators" value={invigilator} onChange={(e) => setInvigilator(e.target.value)} placeholder="Assign a teacher" className={inp} /><datalist id="exam-invigilators">{teachers.map((t) => <option key={t} value={t} />)}</datalist></FF>
      <FF label="Notes (optional)"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any special instructions…" className={`${inp} py-1.5`} /></FF>
      <label className="flex items-center gap-2 text-[12.5px] font-bold text-ink-soft"><input type="checkbox" checked={isWaec} onChange={(e) => setIsWaec(e.target.checked)} className="size-4" />Mark as WAEC-style paper</label>
      <div className="mt-1 flex gap-2"><button onClick={reset} className="rounded-lg border border-border-soft px-3 py-2 text-[12.5px] font-bold text-ink-soft hover:text-ink">Reset</button><Button className="flex-1" onClick={submit} disabled={busy || !subject || !examDate}>{busy ? "Adding…" : "Add to timetable"}</Button></div>
    </section>
  );
}
const inp = "min-h-9 w-full rounded-lg border border-border-soft bg-white px-2.5 text-[12.5px] text-ink outline-none focus:border-brand-blue";
function FF({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1"><span className="text-[10.5px] font-extrabold uppercase tracking-wide text-ink-soft">{label}</span>{children}</label>;
}
