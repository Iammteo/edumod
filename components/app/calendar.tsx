"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getEvents, addEvent, deleteEvent, type SchoolEvent } from "@/lib/actions/events";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD = ["M", "T", "W", "T", "F", "S", "S"];
const KIND_COLOR: Record<string, string> = { event: "#2159e8", exam: "#b9540f", holiday: "#178a4c", meeting: "#6b2fb3" };
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function CalendarCard({ canManage }: { canManage: boolean }) {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(iso(today.getFullYear(), today.getMonth(), today.getDate()));
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("event");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => setEvents(await getEvents()), []);
  useEffect(() => { load(); }, [load]);

  const byDate = useMemo(() => { const m = new Map<string, SchoolEvent[]>(); for (const e of events) { const a = m.get(e.date) ?? []; a.push(e); m.set(e.date, a); } return m; }, [events]);
  const todayStr = iso(today.getFullYear(), today.getMonth(), today.getDate());

  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  function move(delta: number) { const d = new Date(year, month + delta, 1); setYear(d.getFullYear()); setMonth(d.getMonth()); }
  const monthEvents = events.filter((e) => e.date.startsWith(iso(year, month, 1).slice(0, 7))).sort((a, b) => a.date.localeCompare(b.date));

  async function submit() {
    setBusy(true); setErr(null);
    const r = await addEvent({ date, title, kind });
    setBusy(false);
    if ("error" in r) { setErr(r.error); return; }
    setTitle(""); setAdding(false); load();
  }
  async function remove(id: string) { await deleteEvent(id); load(); }

  return (
    <section className="rounded-2xl border border-border-soft bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => move(-1)} aria-label="Previous month" className="grid size-7 place-items-center rounded-lg text-ink-soft hover:bg-paper">‹</button>
        <strong className="text-[13px]">{MONTHS[month]} {year}</strong>
        <button onClick={() => move(1)} aria-label="Next month" className="grid size-7 place-items-center rounded-lg text-ink-soft hover:bg-paper">›</button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WD.map((w, i) => <span key={i} className="text-[10px] font-extrabold uppercase text-brand-blue">{w}</span>)}
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />;
          const ds = iso(year, month, d);
          const isToday = ds === todayStr;
          const evs = byDate.get(ds);
          return (
            <button key={i} onClick={() => { setDate(ds); if (canManage) setAdding(true); }} className="relative mx-auto grid size-7 place-items-center rounded-full text-[11px] font-bold transition hover:bg-paper">
              <span className={`grid size-6 place-items-center rounded-full ${isToday ? "bg-brand-blue text-white" : evs ? "text-warn" : "text-ink"}`}>{d}</span>
              {evs && !isToday && <span className="absolute -bottom-0 size-1 rounded-full" style={{ backgroundColor: KIND_COLOR[evs[0].kind] ?? "#2159e8" }} />}
            </button>
          );
        })}
      </div>

      <div className="mt-3 border-t border-border-soft pt-2.5">
        {monthEvents.length === 0 ? <p className="text-[11px] text-ink-soft">No events this month.{canManage ? " Tap a day to add one." : ""}</p> : (
          <ul className="grid gap-1.5">{monthEvents.slice(0, 5).map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-[11px]">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: KIND_COLOR[e.kind] ?? "#2159e8" }} />
              <span className="font-bold text-ink-soft">{new Date(e.date + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
              <span className="min-w-0 flex-1 truncate text-ink">{e.title}</span>
              {canManage && <button onClick={() => remove(e.id)} className="shrink-0 text-ink-soft hover:text-danger">✕</button>}
            </li>
          ))}</ul>
        )}
      </div>

      {canManage && (adding ? (
        <div className="mt-2.5 grid gap-2 rounded-xl border border-border-soft bg-paper/50 p-2.5">
          {err && <p className="text-[11px] font-bold text-danger">{err}</p>}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-8 rounded-md border border-border-soft bg-white px-2 text-[12px] outline-none focus:border-brand-blue" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event (e.g. PTA Meeting)" className="min-h-8 rounded-md border border-border-soft bg-white px-2 text-[12px] outline-none focus:border-brand-blue" />
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="min-h-8 rounded-md border border-border-soft bg-white px-2 text-[12px] outline-none focus:border-brand-blue"><option value="event">Event</option><option value="meeting">Meeting</option><option value="exam">Exam</option><option value="holiday">Holiday</option></select>
          <div className="flex gap-2"><button onClick={submit} disabled={busy} className="flex-1 rounded-md bg-brand-blue px-3 py-1.5 text-[11px] font-extrabold text-white disabled:opacity-60">{busy ? "Adding…" : "Add"}</button><button onClick={() => setAdding(false)} className="rounded-md border border-border-soft px-3 py-1.5 text-[11px] font-extrabold text-ink-soft">Cancel</button></div>
        </div>
      ) : <button onClick={() => setAdding(true)} className="mt-2.5 w-full rounded-xl border border-dashed border-border-soft py-1.5 text-[11px] font-extrabold text-brand-blue hover:bg-brand-soft">+ Add event</button>)}
    </section>
  );
}
