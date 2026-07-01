"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTimetable, listTeacherNames, setTimetableTitle, addPeriod, updatePeriod, deletePeriod, setSlot, copyTimetableTo, getTimetableAnalytics, getTeacherSchedule, type Timetable, type TimetablePeriod, type SlotEntry, type Clash } from "@/lib/actions/timetable";
import { TIMETABLE_DAYS } from "@/lib/timetable-days";
import { SUBJECTS } from "@/lib/subjects";
import { useClassNames } from "./use-classes";
import { useAcademicTerms } from "./use-terms";
import { Button } from "./ui";

const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const svg = (p: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="size-[17px]">{p}</svg>;
const ICON = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
  grid: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  teacher: <><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5" /></>,
  rooms: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1M9 13h1m4 0h1M9 17h1m4 0h1" /></>,
  exam: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 15l2 2 4-4" /></>,
  publish: <><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></>,
};

type TabKey = "overview" | "class" | "teacher" | "rooms" | "exam" | "publish";
const TABS: { key: TabKey; label: string; icon: React.ReactNode; ready?: boolean }[] = [
  { key: "overview", label: "Overview", icon: ICON.overview },
  { key: "class", label: "Class timetable", icon: ICON.grid, ready: true },
  { key: "teacher", label: "Teacher schedules", icon: ICON.teacher },
  { key: "rooms", label: "Rooms & conflicts", icon: ICON.rooms },
  { key: "exam", label: "Exam timetable", icon: ICON.exam },
  { key: "publish", label: "Publish", icon: ICON.publish },
];

// A soft, deterministic colour per subject so the grid reads at a glance (like the mockup).
const CELL_TONES = [
  { bg: "#eaf1ff", bar: "#3f6fe0", text: "#1e3a8a" }, { bg: "#e9f8ef", bar: "#1f9d57", text: "#166534" },
  { bg: "#f3ecfb", bar: "#8b5cf6", text: "#5b21b6" }, { bg: "#fdeef0", bar: "#e0567b", text: "#9d264a" },
  { bg: "#fff4e6", bar: "#e08a2b", text: "#9a5410" }, { bg: "#e7f7f8", bar: "#0ea5b7", text: "#0e6b76" },
  { bg: "#f0f3f7", bar: "#64748b", text: "#334155" },
];
function toneOf(subject: string) {
  let h = 0; for (let i = 0; i < subject.length; i++) h = (h * 31 + subject.charCodeAt(i)) >>> 0;
  return CELL_TONES[h % CELL_TONES.length];
}
function levelOf(name: string): string {
  if (/^primary/i.test(name)) return "Primary";
  if (/^jss/i.test(name)) return "JSS";
  if (/^sss/i.test(name)) return "SSS";
  return "Other";
}

export function TimetableBuilder() {
  const [tab, setTab] = useState<TabKey>("class");
  return (
    <div className="grid gap-4">
      <BuilderHero />
      <div className="flex flex-wrap gap-1 border-b border-border-soft">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-bold transition ${tab === t.key ? "border-brand-blue text-brand-blue" : "border-transparent text-ink-soft hover:text-ink"}`}>
            <span className={tab === t.key ? "text-brand-blue" : "text-ink-soft"}>{svg(t.icon)}</span>{t.label}
          </button>
        ))}
      </div>
      {tab === "class" ? <ClassTimetableTab />
        : tab === "overview" ? <OverviewTab onGoto={setTab} />
        : tab === "teacher" ? <TeacherTab />
        : tab === "rooms" ? <RoomsTab />
        : <ComingSoonTab tab={TABS.find((t) => t.key === tab)!} />}
    </div>
  );
}

function BuilderHero() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-soft bg-gradient-to-r from-brand-soft/70 via-white to-white p-5">
      <p className="mb-1 flex items-center gap-1 text-[12px] font-bold text-ink-soft">{svg(<path d="m15 18-6-6 6-6" />)}Timetable</p>
      <h1 className="font-display text-[26px] font-bold text-ink">Class timetable builder</h1>
      <p className="mt-1 text-[13.5px] text-ink-soft">Create and manage weekly class timetables with ease.</p>
    </div>
  );
}

function ComingSoonTab({ tab }: { tab: { label: string; icon: React.ReactNode } }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border-soft bg-white py-20 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-xl bg-brand-soft text-brand-blue">{svg(tab.icon)}</div>
      <h2 className="font-display text-[18px] font-semibold">{tab.label} is on the way</h2>
      <p className="mt-1 max-w-md text-[13px] text-ink-soft">We&rsquo;re building this next. The Class timetable builder is fully live now &mdash; start there.</p>
    </div>
  );
}

/* ---------------- Class timetable tab ---------------- */
function ClassTimetableTab() {
  const classes = useClassNames();
  const { current } = useAcademicTerms();
  const [cls, setCls] = useState("");
  const [level, setLevel] = useState("All");
  const [showBreaks, setShowBreaks] = useState(true);
  const [teachers, setTeachers] = useState<string[]>([]);

  const [tt, setTt] = useState<Timetable | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const levels = useMemo(() => ["All", ...[...new Set(classes.map(levelOf))]], [classes]);
  const shown = useMemo(() => (level === "All" ? classes : classes.filter((c) => levelOf(c) === level)), [classes, level]);
  useEffect(() => { if (shown.length && !shown.includes(cls)) setCls(shown[0]); }, [shown, cls]);
  useEffect(() => { listTeacherNames().then(setTeachers); }, []);

  const load = useCallback(() => { if (cls) getTimetable(cls).then(setTt); else setTt({ className: "", title: "", periods: [] }); }, [cls]);
  useEffect(() => { setTt(null); load(); }, [load]);

  // Keep a live ref of the timetable so saveCell always reads the freshest cell values (avoids the
  // stale-closure bug where fast edits after a save didn't persist).
  const ttRef = useRef<Timetable | null>(tt);
  useEffect(() => { ttRef.current = tt; }, [tt]);

  function patchCell(periodId: string, day: number, field: "subject" | "teacher" | "room", value: string) {
    setTt((prev) => prev && ({ ...prev, periods: prev.periods.map((p) => p.id !== periodId ? p : ({ ...p, slots: p.slots.map((s, d) => d === day ? { subject: s?.subject ?? null, teacher: s?.teacher ?? null, room: s?.room ?? null, [field]: value || null } : s) })) }));
  }
  async function saveCell(periodId: string, day: number) {
    const s = ttRef.current?.periods.find((p) => p.id === periodId)?.slots[day];
    setErr(null);
    const r = await setSlot({ periodId, day, subject: s?.subject ?? "", teacher: s?.teacher ?? "", room: s?.room ?? "" });
    if ("error" in r) { setErr(r.error); load(); return; }
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }

  const lessons = tt?.periods.filter((p) => !p.isBreak) ?? [];
  const breaks = tt?.periods.filter((p) => p.isBreak) ?? [];

  // In-class conflict check: same teacher in two places at the same time within THIS class.
  const conflicts = useMemo(() => {
    const out: string[] = [];
    for (let day = 0; day < TIMETABLE_DAYS.length; day++) {
      const seen = new Map<string, string>();
      for (const p of lessons) {
        const s = p.slots[day];
        if (!s?.teacher) continue;
        const key = s.teacher.toLowerCase();
        if (seen.has(key)) out.push(`${s.teacher} is booked twice on ${DAY_LONG[day]} (${seen.get(key)} & ${p.startTime}).`);
        else seen.set(key, p.startTime);
      }
    }
    return out;
  }, [lessons]);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="grid content-start gap-4">
        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border-soft bg-white p-3.5">
          <Field label="Session / Term"><div className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border-soft bg-paper/50 px-2.5 text-[12.5px] font-bold text-ink">{svg(ICON.grid)}<span className="whitespace-nowrap">{current || "Current term"}</span></div></Field>
          <Field label="Level"><Select value={level} onChange={setLevel} options={levels} /></Field>
          <Field label="Class"><Select value={cls} onChange={setCls} options={shown} /></Field>
          <div className="ml-auto flex items-center gap-2 pb-1">
            <span className="text-[12px] font-bold text-ink-soft">Show breaks</span>
            <button role="switch" aria-checked={showBreaks} onClick={() => setShowBreaks((v) => !v)} className={`relative h-6 w-11 rounded-full transition ${showBreaks ? "bg-brand-blue" : "bg-border-soft"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${showBreaks ? "left-[22px]" : "left-0.5"}`} /></button>
          </div>
        </div>

        {err && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[12px] font-bold text-danger">{err}</p>}

        {/* Grid card */}
        <div className="rounded-2xl border border-border-soft bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
            <TitleField className={cls} title={tt?.title ?? ""} onSaved={(t) => setTt((prev) => prev && { ...prev, title: t })} onErr={setErr} />
            {savedAt && <span className="text-[11px] font-bold text-brand-green">✓ Saved {savedAt}</span>}
          </div>

          {tt === null ? <p className="p-6 text-[13px] text-ink-soft">Loading timetable…</p> : (
            <div className="overflow-x-auto p-1.5">
              <table className="w-full min-w-[720px] border-separate border-spacing-1 text-[12px]">
                <thead>
                  <tr>
                    <th className="w-[86px] px-2 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Time</th>
                    {DAY_LONG.map((d, i) => <th key={d} className="px-2 py-2 text-center text-[11.5px] font-extrabold text-ink"><span className="hidden sm:inline">{d}</span><span className="sm:hidden">{DAY_SHORT[i]}</span></th>)}
                  </tr>
                </thead>
                <tbody>
                  {tt.periods.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-[13px] text-ink-soft">No periods yet — add one below to start building.</td></tr>}
                  {tt.periods.map((p) => p.isBreak ? (
                    showBreaks && (
                      <tr key={p.id}>
                        <td className="px-2 py-1 text-[10.5px] font-bold text-ink-soft">{p.startTime}<br/>{p.endTime}</td>
                        <td colSpan={5} className="rounded-lg bg-warn-soft/60 px-3 py-2 text-center text-[12px] font-extrabold uppercase tracking-wide text-warn">
                          <span className="inline-flex items-center gap-2">{p.label || "Break"} <span className="font-bold normal-case text-ink-soft">{p.startTime}–{p.endTime}</span> <PeriodMenu period={p} onChange={load} onErr={setErr} /></span>
                        </td>
                      </tr>
                    )
                  ) : (
                    <tr key={p.id}>
                      <td className="px-2 py-1 align-top text-[10.5px] font-bold text-ink-soft"><span className="whitespace-nowrap">{p.startTime}</span><br/><span className="whitespace-nowrap">{p.endTime}</span><PeriodMenu period={p} onChange={load} onErr={setErr} /></td>
                      {DAY_LONG.map((_, day) => {
                        const s = p.slots[day];
                        const tone = s?.subject ? toneOf(s.subject) : null;
                        return (
                          <td key={day} className="p-0 align-top">
                            <div className="min-h-[58px] rounded-lg border px-2 py-1.5 transition hover:shadow-[0_0_0_2px_rgba(63,111,224,.25)]" style={tone ? { backgroundColor: tone.bg, borderColor: `${tone.bar}44`, borderLeft: `3px solid ${tone.bar}` } : { borderColor: "#e2e9f4", borderStyle: "dashed" }}>
                              <input list="tt-subjects" value={s?.subject ?? ""} onChange={(e) => patchCell(p.id, day, "subject", e.target.value)} onBlur={() => saveCell(p.id, day)} placeholder="+ Subject" className="w-full rounded bg-transparent px-0.5 text-[12px] font-bold outline-none placeholder:font-semibold placeholder:text-ink-soft/50 focus:bg-white/70" style={tone ? { color: tone.text } : undefined} />
                              <input list="tt-teachers" value={s?.teacher ?? ""} onChange={(e) => patchCell(p.id, day, "teacher", e.target.value)} onBlur={() => saveCell(p.id, day)} placeholder="Teacher" className="w-full rounded bg-transparent px-0.5 text-[10.5px] text-ink-soft outline-none placeholder:text-ink-soft/40 focus:bg-white/70" />
                              <input value={s?.room ?? ""} onChange={(e) => patchCell(p.id, day, "room", e.target.value)} onBlur={() => saveCell(p.id, day)} placeholder="Room" className="w-full rounded bg-transparent px-0.5 text-[10.5px] text-ink-soft outline-none placeholder:text-ink-soft/40 focus:bg-white/70" />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-border-soft p-3">
            <AddPeriodForm className={cls} empty={(tt?.periods.length ?? 0) === 0} onAdded={load} onErr={setErr} />
          </div>
        </div>

        <p className="flex items-center gap-2 rounded-xl bg-brand-soft/50 px-3 py-2 text-[12px] text-ink-soft">{svg(<circle cx="12" cy="12" r="10" />)}Designed for Nigerian schools: Assembly, Lunch, Practical sessions, Club Activities and values-based learning.</p>
      </div>

      {/* Right rail */}
      <div className="grid content-start gap-3.5">
        <RailCard title="Available periods" subtitle="Common subjects — click a cell, then a chip to fill it fast">
          <div className="flex flex-wrap gap-1.5">
            {SUBJECTS.slice(0, 10).map((s) => { const t = toneOf(s); return <span key={s} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: t.bg, color: t.text }}>{s}</span>; })}
          </div>
          <p className="mt-2 text-[11px] text-ink-soft">Type any subject into a cell — these are just quick references. Drag-and-drop is coming next.</p>
        </RailCard>

        <RailCard title="Conflict alerts" badge={conflicts.length}>
          {conflicts.length === 0 ? <p className="flex items-center gap-1.5 text-[12px] font-bold text-brand-green">{svg(<><path d="M20 6 9 17l-5-5" /></>)}No conflicts in this class.</p>
            : <ul className="grid gap-1.5">{conflicts.slice(0, 6).map((c, i) => <li key={i} className="flex items-start gap-1.5 rounded-lg bg-warn-soft/50 px-2 py-1.5 text-[11.5px] font-semibold text-ink"><span className="text-warn">⚠</span>{c}</li>)}</ul>}
          <p className="mt-2 text-[11px] text-ink-soft">Cross-class & room clashes arrive with the Rooms tab.</p>
        </RailCard>

        <RailCard title="Quick actions">
          <div className="grid gap-1.5">
            <CopyToClasses fromClass={cls} disabled={(tt?.periods.length ?? 0) === 0} onErr={setErr} />
            <span className="text-[11px] text-ink-soft">Auto-arrange & publish land in later phases.</span>
          </div>
        </RailCard>

        <datalist id="tt-subjects">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
        <datalist id="tt-teachers">{teachers.map((t) => <option key={t} value={t} />)}</datalist>
      </div>
    </div>
  );
}

/* ---------------- small pieces ---------------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1"><span className="text-[10.5px] font-extrabold uppercase tracking-wide text-ink-soft">{label}</span>{children}</label>;
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} className="min-h-9 rounded-lg border border-border-soft bg-white px-2.5 text-[12.5px] font-bold text-ink outline-none focus:border-brand-blue">{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
}
function RailCard({ title, subtitle, badge, children }: { title: string; subtitle?: string; badge?: number; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border-soft bg-white p-4">
      <div className="mb-2 flex items-center justify-between"><h3 className="font-display text-[14px] font-bold text-ink">{title}</h3>{badge != null && badge > 0 && <span className="grid size-5 place-items-center rounded-full bg-warn text-[11px] font-extrabold text-white">{badge}</span>}</div>
      {subtitle && <p className="-mt-1 mb-2 text-[11px] text-ink-soft">{subtitle}</p>}
      {children}
    </section>
  );
}

function TitleField({ className, title, onSaved, onErr }: { className: string; title: string; onSaved: (t: string) => void; onErr: (m: string | null) => void }) {
  const [value, setValue] = useState(title);
  useEffect(() => { setValue(title); }, [title, className]);
  async function save() {
    if (value.trim() === title.trim()) return;
    onErr(null);
    const r = await setTimetableTitle({ className, title: value });
    if ("error" in r) { onErr(r.error); return; }
    onSaved(value.trim());
  }
  return <input value={value} onChange={(e) => setValue(e.target.value)} onBlur={save} placeholder={`${className || "Class"} — Weekly timetable`} className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 font-display text-[16px] font-bold text-ink outline-none hover:border-border-soft focus:border-brand-blue" />;
}

// Inline edit/remove popover for a single period (works for lessons and breaks).
function PeriodMenu({ period, onChange, onErr }: { period: TimetablePeriod; onChange: () => void; onErr: (m: string | null) => void }) {
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
    if (!confirm("Remove this period?")) return;
    setBusy(true); onErr(null);
    const r = await deletePeriod(period.id);
    setBusy(false);
    if ("error" in r) { onErr(r.error); return; }
    onChange();
  }
  return (
    <span className="relative inline-block">
      <button onClick={() => setEditing((v) => !v)} title="Edit period" className="ml-1 align-middle text-ink-soft/60 hover:text-brand-blue">⋯</button>
      {editing && <>
        <div className="fixed inset-0 z-30" onClick={() => setEditing(false)} />
        <div className="absolute left-0 top-6 z-40 grid w-[176px] gap-1.5 rounded-xl border border-border-soft bg-white p-2 text-left shadow-[0_16px_40px_rgba(16,33,63,.18)]">
          <div className="flex items-center gap-1"><input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="min-w-0 flex-1 rounded border border-border-soft px-1 py-0.5 text-[11px]" /><span>–</span><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="min-w-0 flex-1 rounded border border-border-soft px-1 py-0.5 text-[11px]" /></div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="rounded border border-border-soft px-1.5 py-0.5 text-[11px]" />
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft"><input type="checkbox" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} />Break / assembly</label>
          <div className="flex justify-between"><button onClick={save} disabled={busy} className="rounded bg-brand-blue px-2 py-1 text-[11px] font-extrabold text-white disabled:opacity-60">Save</button><button onClick={remove} disabled={busy} className="rounded px-2 py-1 text-[11px] font-bold text-danger">Remove</button></div>
        </div>
      </>}
    </span>
  );
}

function AddPeriodForm({ className, empty, onAdded, onErr }: { className: string; empty: boolean; onAdded: () => void; onErr: (m: string | null) => void }) {
  const [open, setOpen] = useState(empty);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("08:40");
  const [label, setLabel] = useState("");
  const [isBreak, setIsBreak] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setOpen(empty); }, [empty, className]);

  async function add() {
    setBusy(true); onErr(null);
    const r = await addPeriod({ className, startTime: start, endTime: end, label, isBreak });
    setBusy(false);
    if ("error" in r) { onErr(r.error); return; }
    setLabel(""); onAdded();
  }
  function quick(asBreak: boolean) { setIsBreak(asBreak); setLabel(asBreak ? "Break" : ""); setOpen(true); }

  if (!open) return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => quick(false)}>＋ Add period</Button>
      <Button size="sm" variant="secondary" onClick={() => quick(true)}>＋ Add break</Button>
    </div>
  );
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Start"><input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="min-h-9 rounded-lg border border-border-soft bg-white px-2 text-[12px] font-bold text-ink" /></Field>
      <Field label="End"><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="min-h-9 rounded-lg border border-border-soft bg-white px-2 text-[12px] font-bold text-ink" /></Field>
      <Field label={isBreak ? "Label" : "Label (optional)"}><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={isBreak ? "e.g. Lunch, Assembly" : "optional"} className="min-h-9 rounded-lg border border-border-soft bg-white px-2 text-[12px]" /></Field>
      <label className="flex items-center gap-1.5 pb-2 text-[12px] font-bold text-ink-soft"><input type="checkbox" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} />Break</label>
      <Button size="sm" onClick={add} disabled={busy} className="mb-0.5">{busy ? "Adding…" : "Add"}</Button>
      {!empty && <button onClick={() => setOpen(false)} className="pb-2 text-[12px] font-bold text-ink-soft hover:text-ink">Cancel</button>}
    </div>
  );
}

function CopyToClasses({ fromClass, disabled, onErr }: { fromClass: string; disabled: boolean; onErr: (m: string | null) => void }) {
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
  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)} disabled={disabled}>⧉ Copy to other classes</Button>;
  return (
    <div className="rounded-xl border border-border-soft bg-paper/40 p-2.5">
      <div className="mb-1.5 flex items-center justify-between"><span className="text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Copy to…</span><button onClick={() => setOpen(false)} className="text-[11px] font-bold text-ink-soft hover:text-ink">Close</button></div>
      <div className="flex flex-wrap gap-1">
        {others.map((c) => { const on = picked.includes(c); return <button key={c} onClick={() => toggle(c)} className={`rounded-full border px-2 py-1 text-[11px] font-bold transition ${on ? "border-brand-blue bg-brand-blue text-white" : "border-border-soft bg-white text-ink-soft hover:border-brand-blue"}`}>{on ? "✓ " : ""}{c}</button>; })}
      </div>
      <div className="mt-2 flex items-center gap-2"><Button size="sm" onClick={apply} disabled={busy || picked.length === 0}>{busy ? "Copying…" : "Copy"}</Button>{done && <span className="text-[11px] font-bold text-brand-green">✓ {done}</span>}</div>
    </div>
  );
}

/* ---------------- Overview tab ---------------- */
type Analytics = Awaited<ReturnType<typeof getTimetableAnalytics>>;
function StatTile({ label, value, meta, color }: { label: string; value: string | number; meta: string; color: string }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-white p-4">
      <strong className="block font-display text-[26px] font-bold leading-none" style={{ color }}>{value}</strong>
      <small className="mt-1.5 block text-[12px] font-bold text-ink">{label}</small>
      <span className="mt-0.5 block text-[11px] text-ink-soft">{meta}</span>
    </div>
  );
}
function OverviewTab({ onGoto }: { onGoto: (t: TabKey) => void }) {
  const [a, setA] = useState<Analytics | null>(null);
  useEffect(() => { getTimetableAnalytics().then(setA); }, []);
  if (!a) return <p className="p-6 text-[13px] text-ink-soft">Loading…</p>;
  const totalClashes = a.clashes.teacher.length + a.clashes.room.length;
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Classes with a timetable" value={a.classesWithTimetable} meta="Built so far" color="#2159e8" />
        <StatTile label="Lessons scheduled" value={a.lessons} meta="Across all classes" color="#178a4c" />
        <StatTile label="Teachers timetabled" value={a.teachers.length} meta="Named on lessons" color="#8b5cf6" />
        <StatTile label="Conflicts" value={totalClashes} meta={totalClashes ? "Need attention" : "All clear ✓"} color={totalClashes ? "#c0392b" : "#178a4c"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border-soft bg-white p-4">
          <h3 className="mb-2 font-display text-[15px] font-bold">Get started</h3>
          <p className="mb-3 text-[13px] text-ink-soft">Build a class&rsquo;s weekly timetable, then copy it to similar classes and review conflicts.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onGoto("class")}>Open class builder</Button>
            <Button size="sm" variant="secondary" onClick={() => onGoto("teacher")}>Teacher schedules</Button>
            <Button size="sm" variant="secondary" onClick={() => onGoto("rooms")}>Rooms &amp; conflicts</Button>
          </div>
        </section>
        <section className="rounded-2xl border border-border-soft bg-white p-4">
          <h3 className="mb-2 font-display text-[15px] font-bold">Conflict summary</h3>
          {totalClashes === 0 ? <p className="flex items-center gap-1.5 text-[13px] font-bold text-brand-green">{svg(<path d="M20 6 9 17l-5-5" />)}No teacher or room clashes detected.</p>
            : <ul className="grid gap-1.5 text-[12.5px]">
                <li className="font-bold text-ink">{a.clashes.teacher.length} teacher double-booking{a.clashes.teacher.length === 1 ? "" : "s"}</li>
                <li className="font-bold text-ink">{a.clashes.room.length} room clash{a.clashes.room.length === 1 ? "" : "es"}</li>
                <li><button onClick={() => onGoto("rooms")} className="text-[12px] font-bold text-brand-blue hover:underline">View & resolve →</button></li>
              </ul>}
        </section>
      </div>
    </div>
  );
}

/* ---------------- Teacher schedules tab ---------------- */
function EntryWeekGrid({ entries, showClass }: { entries: SlotEntry[]; showClass?: boolean }) {
  const rows = useMemo(() => [...new Set(entries.map((e) => `${e.startTime}|${e.endTime}`))].sort().map((k) => { const [startTime, endTime] = k.split("|"); return { startTime, endTime }; }), [entries]);
  if (entries.length === 0) return <p className="rounded-2xl border border-dashed border-border-soft bg-paper/40 p-6 text-center text-[13px] text-ink-soft">No lessons scheduled.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-border-soft bg-white">
      <table className="w-full min-w-[720px] border-separate border-spacing-1 text-[12px]">
        <thead><tr><th className="w-[86px] px-2 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Time</th>{DAY_LONG.map((d, i) => <th key={d} className="px-2 py-2 text-center text-[11.5px] font-extrabold text-ink"><span className="hidden sm:inline">{d}</span><span className="sm:hidden">{DAY_SHORT[i]}</span></th>)}</tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.startTime}-${row.endTime}`}>
              <td className="px-2 py-1 align-top text-[10.5px] font-bold text-ink-soft"><span className="whitespace-nowrap">{row.startTime}</span><br/><span className="whitespace-nowrap">{row.endTime}</span></td>
              {DAY_LONG.map((_, day) => {
                const cell = entries.filter((e) => e.day === day && e.startTime === row.startTime && e.endTime === row.endTime);
                return <td key={day} className="p-0 align-top">
                  {cell.length === 0 ? <div className="min-h-[52px] rounded-lg border border-dashed border-border-soft" /> : cell.map((e, i) => { const t = toneOf(e.subject ?? e.className); return (
                    <div key={i} className="mb-1 min-h-[52px] rounded-lg border px-2 py-1.5" style={{ backgroundColor: t.bg, borderColor: `${t.bar}44`, borderLeft: `3px solid ${t.bar}` }}>
                      <span className="block text-[12px] font-bold" style={{ color: t.text }}>{e.subject || "—"}</span>
                      {showClass && <span className="block text-[10.5px] font-semibold text-ink-soft">{e.className}</span>}
                      {e.room && <span className="block text-[10.5px] text-ink-soft">{e.room}</span>}
                    </div>
                  ); })}
                </td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function TeacherTab() {
  const [a, setA] = useState<Analytics | null>(null);
  const [teacher, setTeacher] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof getTeacherSchedule>> | null>(null);
  useEffect(() => { getTimetableAnalytics().then((r) => { setA(r); if (r.teachers.length) setTeacher((t) => t || r.teachers[0]); }); }, []);
  useEffect(() => { if (teacher) getTeacherSchedule(teacher).then(setData); else setData(null); }, [teacher]);
  if (!a) return <p className="p-6 text-[13px] text-ink-soft">Loading…</p>;
  if (a.teachers.length === 0) return <p className="rounded-2xl border border-dashed border-border-soft bg-paper/40 p-8 text-center text-[13px] text-ink-soft">No teachers are named on any timetable yet. Add teachers to lessons in the Class timetable tab and they&rsquo;ll appear here.</p>;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border-soft bg-white p-3.5">
        <Field label="Teacher"><Select value={teacher} onChange={setTeacher} options={a.teachers} /></Field>
        {data && <div className="ml-auto flex flex-wrap gap-2">
          <MiniStat label="Periods / week" value={data.periods} />
          <MiniStat label="Classes" value={data.classes} />
          <MiniStat label="Subjects" value={data.subjects.length} />
        </div>}
      </div>
      {data && data.subjects.length > 0 && <p className="text-[12px] text-ink-soft"><span className="font-bold text-ink">Subjects:</span> {data.subjects.join(", ")}</p>}
      {data && <EntryWeekGrid entries={data.entries} showClass />}
    </div>
  );
}
function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-border-soft bg-paper/40 px-3 py-1.5 text-center"><strong className="block font-display text-[18px] font-bold text-brand-blue">{value}</strong><span className="text-[10.5px] font-bold text-ink-soft">{label}</span></div>;
}

/* ---------------- Rooms & conflicts tab ---------------- */
function ClashCard({ clash, kind }: { clash: Clash; kind: "teacher" | "room" }) {
  return (
    <div className="rounded-xl border border-warn-line bg-warn-soft/60 p-3">
      <div className="mb-1 flex items-center justify-between">
        <strong className="text-[13px] text-ink">{kind === "teacher" ? "👤 " : "🏫 "}{clash.name}</strong>
        <span className="rounded-full bg-warn px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">{kind === "teacher" ? "Double-booked" : "Room clash"}</span>
      </div>
      <p className="mb-1.5 text-[11.5px] font-semibold text-ink-soft">{DAY_LONG[clash.day]} · {clash.startTime}–{clash.endTime}</p>
      <div className="flex flex-wrap gap-1.5">{clash.entries.map((e, i) => <span key={i} className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-ink">{e.className}{e.subject ? ` · ${e.subject}` : ""}</span>)}</div>
    </div>
  );
}
function RoomsTab() {
  const [a, setA] = useState<Analytics | null>(null);
  useEffect(() => { getTimetableAnalytics().then(setA); }, []);
  if (!a) return <p className="p-6 text-[13px] text-ink-soft">Loading…</p>;
  const all = [...a.clashes.teacher.map((c) => ({ c, kind: "teacher" as const })), ...a.clashes.room.map((c) => ({ c, kind: "room" as const }))];
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Rooms in use" value={a.rooms.length} meta="Named on lessons" color="#2159e8" />
        <StatTile label="Teacher double-bookings" value={a.clashes.teacher.length} meta={a.clashes.teacher.length ? "Resolve these" : "None ✓"} color={a.clashes.teacher.length ? "#c0392b" : "#178a4c"} />
        <StatTile label="Room clashes" value={a.clashes.room.length} meta={a.clashes.room.length ? "Resolve these" : "None ✓"} color={a.clashes.room.length ? "#c0392b" : "#178a4c"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border-soft bg-white p-4">
          <h3 className="mb-2 font-display text-[15px] font-bold">Conflicts {all.length > 0 && <span className="ml-1 rounded-full bg-warn px-2 py-0.5 text-[11px] font-extrabold text-white">{all.length}</span>}</h3>
          {all.length === 0 ? <p className="flex items-center gap-1.5 text-[13px] font-bold text-brand-green">{svg(<path d="M20 6 9 17l-5-5" />)}No teacher or room clashes. Nice.</p>
            : <div className="grid gap-2">{all.map(({ c, kind }, i) => <ClashCard key={i} clash={c} kind={kind} />)}</div>}
          <p className="mt-2 text-[11px] text-ink-soft">Detected from the class timetables. Fix a clash by changing the room or teacher on one of the clashing lessons in the Class timetable tab.</p>
        </section>
        <section className="rounded-2xl border border-border-soft bg-white p-4">
          <h3 className="mb-2 font-display text-[15px] font-bold">Rooms in use</h3>
          {a.rooms.length === 0 ? <p className="text-[13px] text-ink-soft">No rooms have been set on any lesson yet. Add a room to cells in the Class timetable tab.</p>
            : <div className="flex flex-wrap gap-1.5">{a.rooms.map((r) => <span key={r} className="rounded-lg border border-border-soft bg-paper/40 px-2.5 py-1 text-[12px] font-bold text-ink">{r}</span>)}</div>}
        </section>
      </div>
    </div>
  );
}
