"use client";

import { useState } from "react";
import { createClass, deleteClass } from "@/lib/actions/school-classes";
import { useManagedClasses } from "@/components/app/use-classes";

export function ClassManager() {
  const { rows, reload } = useManagedClasses();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true); setErr(null);
    const r = await createClass(n);
    setBusy(false);
    if ("error" in r) { setErr(r.error); return; }
    setName(""); reload();
  }
  async function del(n: string) {
    if (!confirm(`Remove the class “${n}”?`)) return;
    setErr(null);
    const r = await deleteClass(n);
    if ("error" in r) { setErr(r.error); return; }
    reload();
  }

  return (
    <section className="rounded-2xl border border-border-soft bg-white p-4 sm:p-5">
      <h2 className="font-display text-[16px] font-semibold">Classes</h2>
      <p className="mt-0.5 text-[12px] text-ink-soft">Create your own classes (e.g. streams like “JSS 1A”). Built-in classes can&rsquo;t be removed.</p>
      <form onSubmit={add} className="mt-3 flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New class name (e.g. JSS 1A)" className="min-h-10 min-w-[200px] flex-1 rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] outline-none focus:border-brand-blue" />
        <button type="submit" disabled={busy || !name.trim()} className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-brand-blue px-4 text-[13px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-60">{busy ? "Adding…" : "＋ Add class"}</button>
      </form>
      {err && <p className="mt-2 text-[12px] font-bold text-[#b3261e]">{err}</p>}
      {!rows ? <p className="mt-4 text-[12px] text-ink-soft">Loading…</p>
        : <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">{rows.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-3 rounded-xl border border-border-soft px-3 py-2">
              <div className="min-w-0"><span className="text-[13px] font-bold text-ink">{c.name}</span>{!c.custom && <span className="ml-2 rounded-full bg-paper px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-ink-soft">Built-in</span>}</div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="text-[11px] text-ink-soft">{c.students} student{c.students === 1 ? "" : "s"}</span>
                {c.custom && <button onClick={() => del(c.name)} className="grid size-7 place-items-center rounded-lg text-ink-soft transition hover:bg-[#fdeeee] hover:text-[#b3261e]" title="Remove class">✕</button>}
              </div>
            </li>
          ))}</ul>}
    </section>
  );
}
