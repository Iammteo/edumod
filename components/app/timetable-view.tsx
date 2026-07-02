"use client";

import { useCallback, useEffect, useState } from "react";
import { getTimetable, setTimetableTitle, addPeriod, updatePeriod, deletePeriod, setSlot, copyTimetableTo, type Timetable, type TimetablePeriod } from "@/lib/actions/timetable";
import { TIMETABLE_DAYS } from "@/lib/timetable-days";
import { SUBJECTS } from "@/lib/subjects";
import { useClassNames } from "./use-classes";
import { Button } from "./ui";

const DAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI"];

// One class's weekly timetable, laid out like a printed school timetable: days down the side, lesson
// periods across the top, and break/assembly bands summarised in a line above the grid. Read-only
// unless `canEdit`, in which case the title and subject cells are inline-editable and periods managed.
export function TimetableGrid({ className, canEdit = false }: { className: string; canEdit?: boolean }) {
  const [tt, setTt] = useState<Timetable | null>(null);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!className) { setTt({ className: "", title: "", periods: [] }); return; }
    getTimetable(className).then(setTt);
  }, [className]);
  useEffect(() => { setTt(null); load(); }, [load]);

  // Edit a cell locally, then persist on blur — keeps typing snappy without a round-trip per keystroke.
  function editCell(periodId: string, day: number, value: string) {
    setTt((prev) => prev && ({ ...prev, periods: prev.periods.map((p) => {
      if (p.id !== periodId) return p;
      const slots = p.slots.map((s, d) => d === day ? { subject: value || null } : s);
      return { ...p, slots };
    }) }));
  }
  // Read the value straight from the input so fast cell-to-cell edits can't save a stale/empty value.
  async function saveCell(periodId: string, day: number, value: string) {
    setErr(null);
    const r = await setSlot({ periodId, day, subject: value });
    if ("error" in r) { setErr(r.error); load(); }
  }

  if (tt === null) return <p className="p-4 text-[13px] text-ink-soft">Loading timetable…</p>;
  if (!className) return <p className="rounded-2xl border border-dashed border-border-soft bg-paper/40 p-6 text-center text-[13px] text-ink-soft">Pick a class to see its timetable.</p>;

  const lessons = tt.periods.filter((p) => !p.isBreak); // already sorted by start time
  const breaks = tt.periods.filter((p) => p.isBreak);
  const empty = tt.periods.length === 0;
  const edit = canEdit && editing; // editing chrome stays hidden until the user opts in

  return (
    <div className="grid min-w-0 gap-3">
      {/* Top bar: the clean grid shows by default; one button toggles editing. */}
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" variant={editing ? "primary" : "secondary"} onClick={() => setEditing((v) => !v)}>{editing ? "✓ Done" : "✎ Edit timetable"}</Button>
        </div>
      )}

      {err && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[12px] font-bold text-danger">{err}</p>}

      <TimetableTitle className={className} title={tt.title} canEdit={edit} onSaved={(t) => setTt((prev) => prev && { ...prev, title: t })} onErr={setErr} />

      {empty && !edit && <p className="rounded-2xl border border-dashed border-border-soft bg-paper/40 p-6 text-center text-[13px] text-ink-soft">No timetable has been set up for {className} yet.{canEdit && " Click “Edit timetable” to build it."}</p>}

      {/* Break / assembly bands, summarised on one line like a printed timetable. */}
      {breaks.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-xl bg-paper/70 px-3 py-2 text-center text-[12.5px] font-bold text-ink">
          {breaks.map((b, i) => (
            <span key={b.id} className="inline-flex items-center gap-2">
              {i > 0 && <span aria-hidden className="text-ink-soft/40">|</span>}
              <span>{b.label || "Break"}: {b.startTime}–{b.endTime}</span>
              {edit && <PeriodControls period={b} onChange={load} onErr={setErr} />}
            </span>
          ))}
        </div>
      )}

      {lessons.length > 0 && (
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-border-soft bg-white">
          <table className="w-full min-w-[560px] border-collapse text-center text-[12.5px]">
            <thead>
              <tr className="bg-paper/60 text-ink-soft">
                <th className="sticky left-0 z-10 border-b border-r border-border-soft bg-paper/60 px-3 py-2.5" />
                {lessons.map((p) => (
                  <th key={p.id} className="min-w-[104px] border-b border-l border-border-soft px-2 py-2 align-top">
                    <span className="block whitespace-nowrap text-[11.5px] font-extrabold text-ink">{p.startTime}–{p.endTime}</span>
                    {p.label && <span className="block text-[10px] font-bold text-ink-soft">{p.label}</span>}
                    {edit && <PeriodControls period={p} onChange={load} onErr={setErr} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIMETABLE_DAYS.map((d, day) => (
                <tr key={d} className="odd:bg-white even:bg-paper/25">
                  <th className="sticky left-0 z-10 border-r border-t border-border-soft bg-inherit px-3 py-2 text-[12px] font-extrabold text-ink">{DAY_SHORT[day]}</th>
                  {lessons.map((p) => {
                    const s = p.slots[day];
                    return (
                      <td key={p.id} className="border-l border-t border-border-soft px-1.5 py-1.5 align-middle">
                        {edit ? (
                          <input list="tt-subjects" value={s?.subject ?? ""} onChange={(e) => editCell(p.id, day, e.target.value)} onBlur={(e) => saveCell(p.id, day, e.target.value)} placeholder="—" className="w-full rounded-md border border-transparent bg-transparent px-1 py-1.5 text-center text-[12px] font-bold text-ink outline-none hover:border-border-soft focus:border-brand-blue focus:bg-white" />
                        ) : s?.subject ? (
                          <span className="font-bold leading-tight text-ink">{s.subject}</span>
                        ) : <span className="text-ink-soft/40">–</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && <>
        <AddPeriodForm className={className} empty={empty} lastEnd={tt.periods.reduce((m, p) => (p.endTime > m ? p.endTime : m), "")} onAdded={load} onErr={setErr} />
        {!empty && <CopyToClasses fromClass={className} onErr={setErr} />}
        <datalist id="tt-subjects">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
      </>}
    </div>
  );
}

// Copy this class's timetable onto other classes (replacing theirs). Shown only in edit mode.
function CopyToClasses({ fromClass, onErr }: { fromClass: string; onErr: (m: string | null) => void }) {
  const classes = useClassNames();
  const others = classes.filter((c) => c !== fromClass);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  function toggle(name: string) { setPicked((p) => p.includes(name) ? p.filter((x) => x !== name) : [...p, name]); setDone(null); }
  async function apply() {
    if (picked.length === 0) return;
    if (!confirm(`Copy ${fromClass}'s timetable to ${picked.length} class(es)? This replaces their current timetable.`)) return;
    setBusy(true); onErr(null); setDone(null);
    const r = await copyTimetableTo({ fromClass, toClasses: picked });
    setBusy(false);
    if ("error" in r) { onErr(r.error); return; }
    setDone(`Copied to ${r.count} class${r.count === 1 ? "" : "es"}.`); setPicked([]);
  }

  if (others.length === 0) return null;
  if (!open) return <div><Button size="sm" variant="secondary" onClick={() => setOpen(true)}>⧉ Copy to other classes</Button></div>;
  return (
    <div className="rounded-2xl border border-border-soft bg-paper/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Copy {fromClass}&rsquo;s timetable to…</p>
        <button onClick={() => setOpen(false)} className="text-[12px] font-bold text-ink-soft hover:text-ink">Close</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {others.map((c) => {
          const on = picked.includes(c);
          return <button key={c} onClick={() => toggle(c)} className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition ${on ? "border-brand-blue bg-brand-blue text-white" : "border-border-soft bg-white text-ink-soft hover:border-brand-blue hover:text-brand-blue"}`}>{on ? "✓ " : ""}{c}</button>;
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={apply} disabled={busy || picked.length === 0}>{busy ? "Copying…" : `Copy to ${picked.length || ""} ${picked.length === 1 ? "class" : "classes"}`.trim()}</Button>
        {done && <span className="text-[12px] font-bold text-brand-green">✓ {done}</span>}
      </div>
      <p className="mt-2 text-[11px] text-ink-soft">This replaces the selected classes&rsquo; existing timetables. Titles aren&rsquo;t copied.</p>
    </div>
  );
}

// Editable heading above the grid. Read-only shows the title (hidden if blank); edit mode is an inline
// input saved on blur.
function TimetableTitle({ className, title, canEdit, onSaved, onErr }: { className: string; title: string; canEdit: boolean; onSaved: (t: string) => void; onErr: (m: string | null) => void }) {
  const [value, setValue] = useState(title);
  useEffect(() => { setValue(title); }, [title, className]);

  async function save() {
    if (value.trim() === title.trim()) return;
    onErr(null);
    const r = await setTimetableTitle({ className, title: value });
    if ("error" in r) { onErr(r.error); return; }
    onSaved(value.trim());
  }

  if (!canEdit) return title ? <h3 className="text-center font-display text-[17px] font-bold text-ink">{title}</h3> : null;
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      placeholder="Add a title (e.g. Class Timetable — JSS 1A)"
      className="mx-auto w-full max-w-md rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-center font-display text-[17px] font-bold text-ink outline-none transition placeholder:text-[13px] placeholder:font-bold placeholder:text-ink-soft/60 hover:border-border-soft focus:border-brand-blue focus:bg-white"
    />
  );
}

// Compact edit/remove for a single period (works for both lesson columns and break bands).
function PeriodControls({ period, onChange, onErr }: { period: TimetablePeriod; onChange: () => void; onErr: (m: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(period.startTime);
  const [end, setEnd] = useState(period.endTime);
  const [label, setLabel] = useState(period.label ?? "");
  const [isBreak, setIsBreak] = useState(period.isBreak);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); onErr(null);
    const r = await updatePeriod({ id: period.id, startTime: start, endTime: end, label, isBreak });
    setBusy(false);
    if ("error" in r) { onErr(r.error); return; }
    setEditing(false); onChange();
  }
  async function remove() {
    if (!confirm("Remove this period from the timetable?")) return;
    setBusy(true); onErr(null);
    const r = await deletePeriod(period.id);
    setBusy(false);
    if ("error" in r) { onErr(r.error); return; }
    onChange();
  }

  if (!editing) return (
    <span className="mt-0.5 flex justify-center gap-2">
      <button onClick={() => setEditing(true)} className="text-[9.5px] font-extrabold uppercase tracking-wide text-brand-blue hover:underline">Edit</button>
      <button onClick={remove} disabled={busy} className="text-[9.5px] font-extrabold uppercase tracking-wide text-danger hover:underline disabled:opacity-50">Remove</button>
    </span>
  );
  return (
    <div className="relative mt-1 inline-block text-left">
      <div className="absolute left-1/2 top-0 z-30 grid w-[168px] -translate-x-1/2 gap-1.5 rounded-xl border border-border-soft bg-white p-2 shadow-[0_16px_40px_rgba(16,33,63,.18)]">
        <div className="flex items-center gap-1"><input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="min-w-0 flex-1 rounded border border-border-soft bg-white px-1 py-0.5 text-[11px]" /><span className="text-ink-soft">–</span><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="min-w-0 flex-1 rounded border border-border-soft bg-white px-1 py-0.5 text-[11px]" /></div>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="rounded border border-border-soft bg-white px-1.5 py-0.5 text-[11px]" />
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft"><input type="checkbox" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} />Break / assembly</label>
        <div className="flex gap-1.5"><button onClick={save} disabled={busy} className="rounded bg-brand-blue px-2 py-1 text-[11px] font-extrabold text-white disabled:opacity-60">Save</button><button onClick={() => setEditing(false)} className="rounded px-2 py-1 text-[11px] font-bold text-ink-soft">Cancel</button></div>
      </div>
    </div>
  );
}

function addMinutes(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, (h || 0) * 60 + (m || 0) + mins);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function AddPeriodForm({ className, empty, lastEnd, onAdded, onErr }: { className: string; empty: boolean; lastEnd: string; onAdded: () => void; onErr: (m: string | null) => void }) {
  const [open, setOpen] = useState(empty);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("08:40");
  const [label, setLabel] = useState("");
  const [isBreak, setIsBreak] = useState(false);
  const [busy, setBusy] = useState(false);
  // Default a new period to start where the last one ends, so it lands at the BOTTOM.
  const nextStart = lastEnd || "08:00";
  useEffect(() => { setOpen(empty); if (empty) { setStart(nextStart); setEnd(addMinutes(nextStart, 40)); } }, [empty, className, nextStart]);

  async function add() {
    setBusy(true); onErr(null);
    const r = await addPeriod({ className, startTime: start, endTime: end, label, isBreak });
    setBusy(false);
    if ("error" in r) { onErr(r.error); return; }
    setStart(end); setEnd(addMinutes(end, 40)); setLabel(""); onAdded();
  }
  function quick(asBreak: boolean) { setIsBreak(asBreak); setLabel(asBreak ? "Break" : ""); setStart(nextStart); setEnd(addMinutes(nextStart, asBreak ? 15 : 40)); setOpen(true); }

  if (!open) return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => quick(false)}>＋ Add period</Button>
      <Button size="sm" variant="secondary" onClick={() => quick(true)}>＋ Add break</Button>
    </div>
  );
  return (
    <div className="rounded-2xl border border-border-soft bg-paper/40 p-3">
      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Add {isBreak ? "a break" : "a period"} to {className}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[11px] font-bold text-ink-soft">Start<input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-border-soft bg-white px-2 py-1.5 text-[12px] font-bold text-ink" /></label>
        <label className="grid gap-1 text-[11px] font-bold text-ink-soft">End<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border border-border-soft bg-white px-2 py-1.5 text-[12px] font-bold text-ink" /></label>
        <label className="grid flex-1 gap-1 text-[11px] font-bold text-ink-soft">Label {isBreak ? "" : "(optional)"}<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={isBreak ? "e.g. Lunch, Assembly" : "optional"} className="rounded-lg border border-border-soft bg-white px-2 py-1.5 text-[12px]" /></label>
        <label className="flex items-center gap-1.5 pb-2 text-[12px] font-bold text-ink-soft"><input type="checkbox" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} />Break</label>
        <Button size="sm" onClick={add} disabled={busy} className="mb-0.5">{busy ? "Adding…" : "Add"}</Button>
        {!empty && <button onClick={() => setOpen(false)} className="pb-2 text-[12px] font-bold text-ink-soft hover:text-ink">Cancel</button>}
      </div>
    </div>
  );
}
