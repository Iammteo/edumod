"use client";

import { useEffect, useMemo, useState } from "react";
import { listAcademicTerms, setCurrentPeriod, createAcademicTerm, deleteAcademicTerm, type SessionTerm } from "@/lib/actions/academics";

const I = (p: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">{p}</svg>;

// The session/term control in the greeting banner. Everyone allowed to see it can SWITCH the active
// term (server-enforced to leadership + secretary). Only `canManage` (admin) also gets add/remove.
export function TermSwitcher({ canManage = false, onChange }: { canManage?: boolean; onChange?: (session: string, term: string) => void }) {
  const [list, setList] = useState<SessionTerm[] | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newSession, setNewSession] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const reload = () => listAcademicTerms().then(setList);
  useEffect(() => { reload(); }, []);
  const cur = list?.find((x) => x.current);
  const label = cur ? `${cur.session} · ${cur.term}` : "Select term";

  const groups = useMemo(() => {
    const m = new Map<string, SessionTerm[]>();
    for (const x of list ?? []) { const g = m.get(x.session) ?? (m.set(x.session, []), m.get(x.session)!); g.push(x); }
    return [...m.entries()];
  }, [list]);

  async function pick(session: string, term: string) {
    if (cur && session === cur.session && term === cur.term) { setOpen(false); return; }
    setSaving(true); setErr(null);
    const r = await setCurrentPeriod({ session, term });
    setSaving(false);
    if ("error" in r) { setErr(r.error); return; }
    onChange?.(session, term); setOpen(false); reload();
  }
  async function add() {
    setErr(null);
    const r = await createAcademicTerm({ session: newSession, term: newTerm });
    if ("error" in r) { setErr(r.error); return; }
    setNewTerm(""); setAdding(false); reload();
  }
  async function remove(session: string, term: string) {
    setErr(null);
    const r = await deleteAcademicTerm({ session, term });
    if ("error" in r) { setErr(r.error); return; }
    reload();
  }

  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((v) => !v)} disabled={saving} aria-haspopup="listbox" aria-expanded={open} className="inline-flex items-center gap-2 rounded-[12px] bg-white/95 px-3.5 py-2.5 text-[13px] font-bold text-ink shadow-[0_4px_14px_rgba(16,33,63,.18)] transition hover:bg-white disabled:opacity-70">
        <span className="text-brand-blue">{I(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>)}</span>{label}
        {saving ? <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-ink-soft/30 border-t-ink-soft" /> : <span className={`transition ${open ? "rotate-180" : ""}`}>{I(<path d="m6 9 6 6 6-6" />)}</span>}
      </button>
      {open && <><div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setAdding(false); }} /><div className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-[60vh] w-64 overflow-y-auto rounded-xl border border-border-soft bg-white p-1.5 text-ink shadow-[0_20px_50px_rgba(16,33,63,.2)] motion-safe:animate-[fade-up_.2s_ease]">
        <p className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Switch session &amp; term</p>
        {list === null ? <p className="px-2 py-2 text-[12px] text-ink-soft">Loading…</p>
          : groups.length === 0 ? <p className="px-2 py-2 text-[12px] text-ink-soft">No terms yet.</p>
          : groups.map(([session, terms]) => (
            <div key={session} className="mb-1">
              <p className="px-2 pt-1.5 text-[10px] font-extrabold text-ink-soft">{session}</p>
              {terms.map((t) => (
                <div key={t.term} className={`group flex items-center gap-1 rounded-lg pr-1 ${t.current ? "bg-brand-soft" : "hover:bg-paper"}`}>
                  <button onClick={() => pick(t.session, t.term)} className={`flex flex-1 items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12px] font-bold ${t.current ? "text-brand-blue" : "text-ink"}`}>{t.term}{t.current && <span>✓</span>}</button>
                  {canManage && !t.current && <button onClick={() => remove(t.session, t.term)} title="Remove" className="hidden size-6 shrink-0 place-items-center rounded text-ink-soft transition hover:bg-danger-soft hover:text-danger group-hover:grid">✕</button>}
                </div>
              ))}
            </div>
          ))}
        {canManage && <div className="mt-1 border-t border-border-soft pt-1.5">
          {adding ? (
            <div className="grid gap-1.5 p-1.5">
              <input value={newSession} onChange={(e) => setNewSession(e.target.value)} placeholder="Session (e.g. 2024/2025)" className="min-h-8 rounded-lg border border-border-soft bg-paper/60 px-2 text-[12px] outline-none focus:border-brand-blue" />
              <input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="Term (e.g. Term 1)" className="min-h-8 rounded-lg border border-border-soft bg-paper/60 px-2 text-[12px] outline-none focus:border-brand-blue" />
              <div className="flex gap-1.5"><button onClick={add} disabled={!newSession.trim() || !newTerm.trim()} className="flex-1 rounded-lg bg-brand-blue px-2 py-1.5 text-[12px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-60">Add</button><button onClick={() => setAdding(false)} className="rounded-lg px-2 py-1.5 text-[12px] font-bold text-ink-soft hover:text-ink">Cancel</button></div>
            </div>
          ) : (
            <button onClick={() => { setAdding(true); setNewSession(cur?.session ?? ""); setNewTerm(""); }} className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-extrabold text-brand-blue hover:bg-brand-soft">＋ New session / term</button>
          )}
        </div>}
        {err && <p className="px-2 py-1 text-[11px] font-bold text-danger">{err}</p>}
      </div></>}
    </div>
  );
}
