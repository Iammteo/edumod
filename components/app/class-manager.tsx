"use client";

import { useState } from "react";
import { createClass, deleteClass, renameClass } from "@/lib/actions/school-classes";
import { useManagedClasses } from "@/components/app/use-classes";
import { Button } from "./ui";

export function ClassManager() {
  const { rows, reload } = useManagedClasses();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

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
  function startEdit(n: string) { setEditing(n); setDraft(n); setErr(null); }
  async function saveEdit() {
    if (!editing) return;
    const to = draft.trim();
    if (!to || to === editing) { setEditing(null); return; }
    setBusy(true); setErr(null);
    const r = await renameClass(editing, to);
    setBusy(false);
    if ("error" in r) { setErr(r.error); return; }
    setEditing(null); reload();
  }
  async function del(n: string) {
    if (!confirm(`Remove the class “${n}”?`)) return;
    setErr(null);
    const r = await deleteClass(n);
    if ("error" in r) { setErr(r.error); return; }
    reload();
  }

  const pencil = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;

  return (
    <section className="rounded-2xl border border-border-soft bg-white p-4 sm:p-5">
      <h2 className="font-display text-[16px] font-semibold">Classes</h2>
      <p className="mt-0.5 text-[12px] text-ink-soft">Create, rename or remove classes - including the built-in ones. Renaming a class updates every student in it.</p>
      <form onSubmit={add} className="mt-3 flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New class name (e.g. JSS 1A)" className="min-h-10 min-w-[200px] flex-1 rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] outline-none focus:border-brand-blue" />
        <Button type="submit" variant="primary" size="md" disabled={busy || !name.trim()}>＋ Add class</Button>
      </form>
      {err && <p className="mt-2 text-[12px] font-bold text-danger">{err}</p>}
      {!rows ? <p className="mt-4 text-[12px] text-ink-soft">Loading…</p>
        : <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">{rows.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-2 rounded-xl border border-border-soft px-3 py-2">
              {editing === c.name ? (
                <>
                  <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }} className="min-h-8 min-w-0 flex-1 rounded-lg border border-brand-blue/40 bg-white px-2 text-[13px] font-bold outline-none focus:border-brand-blue" />
                  <button onClick={saveEdit} disabled={busy} className="rounded-lg bg-brand-blue px-2.5 py-1 text-[11px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-60">Save</button>
                  <button onClick={() => setEditing(null)} className="rounded-lg px-2 py-1 text-[11px] font-bold text-ink-soft hover:text-ink">Cancel</button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1"><span className="text-[13px] font-bold text-ink">{c.name}</span>{c.builtin && <span className="ml-2 rounded-full bg-paper px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-ink-soft">Default</span>}</div>
                  <span className="shrink-0 text-[11px] text-ink-soft">{c.students} student{c.students === 1 ? "" : "s"}</span>
                  <button onClick={() => startEdit(c.name)} className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-brand-soft hover:text-brand-blue" title="Rename class">{pencil}</button>
                  <button onClick={() => del(c.name)} className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-danger-soft hover:text-danger" title="Remove class">✕</button>
                </>
              )}
            </li>
          ))}</ul>}
    </section>
  );
}
