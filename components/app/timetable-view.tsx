"use client";

import { useCallback, useEffect, useState } from "react";
import { getTimetable, listTeacherNames, addPeriod, updatePeriod, deletePeriod, setSlot, type Timetable, type TimetablePeriod } from "@/lib/actions/timetable";
import { TIMETABLE_DAYS } from "@/lib/timetable-days";
import { SUBJECTS } from "@/lib/subjects";
import { Button } from "./ui";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// One class's weekly timetable. Read-only unless `canEdit`, in which case cells are inline-editable and
// period rows can be added / retimed / removed. Used by admin (with a class picker), teachers and students.
export function TimetableGrid({ className, canEdit = false }: { className: string; canEdit?: boolean }) {
  const [tt, setTt] = useState<Timetable | null>(null);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!className) { setTt({ className: "", periods: [] }); return; }
    getTimetable(className).then(setTt);
  }, [className]);
  useEffect(() => { setTt(null); load(); }, [load]);
  useEffect(() => { if (canEdit) listTeacherNames().then(setTeachers); }, [canEdit]);

  // Edit a cell locally, then persist on blur. Keeps the grid snappy without a round-trip per keystroke.
  function editCell(periodId: string, day: number, field: "subject" | "teacher", value: string) {
    setTt((prev) => prev && ({ ...prev, periods: prev.periods.map((p) => {
      if (p.id !== periodId) return p;
      const slots = p.slots.map((s, d) => d === day ? { subject: s?.subject ?? null, teacher: s?.teacher ?? null, room: s?.room ?? null, [field]: value || null } : s);
      return { ...p, slots };
    }) }));
  }
  async function saveCell(period: TimetablePeriod, day: number) {
    const s = period.slots[day];
    setErr(null);
    const r = await setSlot({ periodId: period.id, day, subject: s?.subject ?? "", teacher: s?.teacher ?? "" });
    if ("error" in r) { setErr(r.error); load(); }
  }

  if (tt === null) return <p className="p-4 text-[13px] text-ink-soft">Loading timetable…</p>;
  if (!className) return <p className="rounded-2xl border border-dashed border-border-soft bg-paper/40 p-6 text-center text-[13px] text-ink-soft">Pick a class to see its timetable.</p>;

  const empty = tt.periods.length === 0;

  return (
    <div className="grid gap-3">
      {err && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[12px] font-bold text-danger">{err}</p>}

      {empty && !canEdit && (
        <p className="rounded-2xl border border-dashed border-border-soft bg-paper/40 p-6 text-center text-[13px] text-ink-soft">No timetable has been set up for {className} yet.</p>
      )}

      {(!empty) && (
        <div className="overflow-x-auto rounded-2xl border border-border-soft bg-white">
          <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-paper/60 text-ink-soft">
                <th className="sticky left-0 z-10 border-b border-r border-border-soft bg-paper/60 px-3 py-2.5 text-left text-[11px] font-extrabold uppercase tracking-wide">Time</th>
                {TIMETABLE_DAYS.map((d, i) => <th key={d} className="border-b border-border-soft px-3 py-2.5 text-left text-[11px] font-extrabold uppercase tracking-wide"><span className="hidden sm:inline">{d}</span><span className="sm:hidden">{DAY_SHORT[i]}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {tt.periods.map((p) => (
                <tr key={p.id} className={p.isBreak ? "bg-brand-soft/40" : "odd:bg-white even:bg-paper/30"}>
                  <th className="sticky left-0 z-10 border-r border-t border-border-soft bg-inherit px-3 py-2 text-left align-top">
                    <span className="block whitespace-nowrap font-extrabold text-ink">{p.startTime}–{p.endTime}</span>
                    {p.label && <span className="block text-[11px] font-bold text-ink-soft">{p.label}</span>}
                    {canEdit && <PeriodControls period={p} onChange={load} onErr={setErr} />}
                  </th>
                  {p.isBreak ? (
                    <td colSpan={TIMETABLE_DAYS.length} className="border-t border-border-soft px-3 py-2 text-center text-[12px] font-extrabold uppercase tracking-wide text-brand-blue">{p.label || "Break"}</td>
                  ) : (
                    TIMETABLE_DAYS.map((_, day) => {
                      const s = p.slots[day];
                      return (
                        <td key={day} className="border-l border-t border-border-soft px-2 py-1.5 align-top">
                          {canEdit ? (
                            <div className="grid gap-1">
                              <input list="tt-subjects" value={s?.subject ?? ""} onChange={(e) => editCell(p.id, day, "subject", e.target.value)} onBlur={() => saveCell(p, day)} placeholder="Subject" className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[12px] font-bold text-ink outline-none hover:border-border-soft focus:border-brand-blue focus:bg-white" />
                              <input list="tt-teachers" value={s?.teacher ?? ""} onChange={(e) => editCell(p.id, day, "teacher", e.target.value)} onBlur={() => saveCell(p, day)} placeholder="Teacher" className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[11px] text-ink-soft outline-none hover:border-border-soft focus:border-brand-blue focus:bg-white" />
                            </div>
                          ) : s?.subject || s?.teacher ? (
                            <div className="min-w-[92px]"><span className="block font-bold text-ink">{s?.subject}</span>{s?.teacher && <span className="block text-[11px] text-ink-soft">{s.teacher}</span>}</div>
                          ) : <span className="text-ink-soft/40">–</span>}
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && <>
        <AddPeriodForm className={className} empty={empty} onAdded={load} onErr={setErr} />
        <datalist id="tt-subjects">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
        <datalist id="tt-teachers">{teachers.map((t) => <option key={t} value={t} />)}</datalist>
      </>}
    </div>
  );
}

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
    <div className="mt-1 flex gap-2">
      <button onClick={() => setEditing(true)} className="text-[10px] font-extrabold uppercase tracking-wide text-brand-blue hover:underline">Edit</button>
      <button onClick={remove} disabled={busy} className="text-[10px] font-extrabold uppercase tracking-wide text-danger hover:underline disabled:opacity-50">Remove</button>
    </div>
  );
  return (
    <div className="mt-1.5 grid w-[160px] gap-1.5">
      <div className="flex items-center gap-1"><input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="min-w-0 flex-1 rounded border border-border-soft bg-white px-1 py-0.5 text-[11px]" /><span className="text-ink-soft">–</span><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="min-w-0 flex-1 rounded border border-border-soft bg-white px-1 py-0.5 text-[11px]" /></div>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="rounded border border-border-soft bg-white px-1.5 py-0.5 text-[11px]" />
      <label className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft"><input type="checkbox" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} />Break / assembly</label>
      <div className="flex gap-1.5"><button onClick={save} disabled={busy} className="rounded bg-brand-blue px-2 py-1 text-[11px] font-extrabold text-white disabled:opacity-60">Save</button><button onClick={() => setEditing(false)} className="rounded px-2 py-1 text-[11px] font-bold text-ink-soft">Cancel</button></div>
    </div>
  );
}

function AddPeriodForm({ className, empty, onAdded, onErr }: { className: string; empty: boolean; onAdded: () => void; onErr: (m: string | null) => void }) {
  const [open, setOpen] = useState(empty);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("08:40");
  const [label, setLabel] = useState("");
  const [isBreak, setIsBreak] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true); onErr(null);
    const r = await addPeriod({ className, startTime: start, endTime: end, label, isBreak });
    setBusy(false);
    if ("error" in r) { onErr(r.error); return; }
    setLabel(""); setIsBreak(false); onAdded();
  }

  if (!open) return <div><Button size="sm" variant="secondary" onClick={() => setOpen(true)}>＋ Add period</Button></div>;
  return (
    <div className="rounded-2xl border border-border-soft bg-paper/40 p-3">
      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Add a period to {className}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[11px] font-bold text-ink-soft">Start<input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-border-soft bg-white px-2 py-1.5 text-[12px] font-bold text-ink" /></label>
        <label className="grid gap-1 text-[11px] font-bold text-ink-soft">End<input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border border-border-soft bg-white px-2 py-1.5 text-[12px] font-bold text-ink" /></label>
        <label className="grid flex-1 gap-1 text-[11px] font-bold text-ink-soft">Label (optional)<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Assembly, Break" className="rounded-lg border border-border-soft bg-white px-2 py-1.5 text-[12px]" /></label>
        <label className="flex items-center gap-1.5 pb-2 text-[12px] font-bold text-ink-soft"><input type="checkbox" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} />Break</label>
        <Button size="sm" onClick={add} disabled={busy} className="mb-0.5">{busy ? "Adding…" : "Add"}</Button>
        {!empty && <button onClick={() => setOpen(false)} className="pb-2 text-[12px] font-bold text-ink-soft hover:text-ink">Cancel</button>}
      </div>
    </div>
  );
}
