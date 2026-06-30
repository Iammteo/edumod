"use client";

import { useCallback, useEffect, useState } from "react";
import { getPromotionPlan, promoteStudents, type PromotionGroup } from "@/lib/actions/promotion";
import { LoadingPanel, LoadError } from "./skeleton";
import { Button, Alert } from "./ui";

// End-of-session promotion: next class is pre-filled per student; admin retains/overrides, then applies.
export function PromotionScreen() {
  const [plan, setPlan] = useState<{ groups: PromotionGroup[]; classOptions: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    const r = await getPromotionPlan();
    if ("error" in r) { setErr(r.error); return; }
    setPlan(r);
    const t: Record<string, string> = {};
    for (const g of r.groups) for (const s of g.students) t[s.id] = g.suggested;
    setTargets(t);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (err && !plan) return <LoadError message={err} onRetry={load} />;
  if (!plan) return <LoadingPanel stats={3} rows={8} />;

  const currentOf = new Map<string, string>();
  plan.groups.forEach((g) => g.students.forEach((s) => currentOf.set(s.id, g.className)));
  const changedMoves = Object.entries(targets).filter(([id, t]) => t !== currentOf.get(id));
  const changes = changedMoves.length;
  const graduating = Object.values(targets).filter((t) => t === "Graduated").length;

  const setGroup = (g: PromotionGroup, to: string) => setTargets((p) => { const n = { ...p }; for (const s of g.students) n[s.id] = to; return n; });

  async function apply() {
    if (changedMoves.length === 0) return;
    if (!confirm(`Apply promotion to ${changes} student${changes === 1 ? "" : "s"}${graduating ? ` (${graduating} graduating)` : ""}? This changes their class.`)) return;
    setBusy(true); setErr(null); setMsg(null);
    const r = await promoteStudents({ moves: changedMoves.map(([studentId, toClass]) => ({ studentId, toClass })) });
    setBusy(false);
    if ("error" in r) { setErr(r.error); return; }
    setMsg(`${r.count} student${r.count === 1 ? "" : "s"} promoted.`); load();
  }

  return (
    <div className="grid gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border-soft bg-white p-4">
        <div><h3 className="font-display text-[15px] font-semibold">Promote students</h3><p className="text-[12px] text-ink-soft">Next class is pre-filled. Retain or override any student, then apply. <b>{changes}</b> change{changes === 1 ? "" : "s"}{graduating ? ` · ${graduating} graduating` : ""}.</p></div>
        <Button onClick={apply} variant="primary" size="md" disabled={busy || changes === 0}>{busy ? "Applying…" : `Apply promotion (${changes})`}</Button>
      </div>
      {err && <Alert tone="error">{err}</Alert>}
      {msg && <Alert tone="success">{msg}</Alert>}

      {plan.groups.length === 0 ? <div className="grid place-items-center rounded-2xl border border-dashed border-border-soft bg-white py-16 text-[12px] text-ink-soft">No students to promote yet.</div> : plan.groups.map((g) => {
        const opts = plan.classOptions.filter((c) => c !== g.className);
        return (
          <section key={g.className} className="rounded-2xl border border-border-soft bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-display text-[14px] font-semibold">{g.className === "Unassigned" ? "Unassigned" : g.className} <span className="text-[11px] font-bold text-ink-soft">· {g.students.length} student{g.students.length === 1 ? "" : "s"}{g.className !== "Unassigned" ? ` · suggested → ${g.suggested}` : ""}</span></h4>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-ink-soft">Set all to <select onChange={(e) => { if (e.target.value) setGroup(g, e.target.value); }} value="" className="min-h-8 rounded-[8px] border border-border-soft bg-white px-2 text-[12px] outline-none focus:border-brand-blue"><option value="">choose…</option><option value={g.className}>Retain ({g.className})</option>{opts.map((c) => <option key={c} value={c}>{c === "Graduated" ? "🎓 Graduate" : c}</option>)}</select></label>
            </div>
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[12px]">
                <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="px-2 py-2 font-bold">Student</th><th className="px-2 py-2 font-bold">Promote to</th></tr></thead>
                <tbody>{g.students.map((s) => { const t = targets[s.id] ?? g.suggested; const changed = t !== g.className; return (
                  <tr key={s.id} className="border-b border-border-soft last:border-0">
                    <td className="px-2 py-2 font-bold text-ink">{s.name}</td>
                    <td className="px-2 py-2"><select value={t} onChange={(e) => setTargets((p) => ({ ...p, [s.id]: e.target.value }))} className={`min-h-8 rounded-[8px] border px-2 text-[12px] font-bold outline-none ${t === "Graduated" ? "border-accent-purple text-accent-purple" : changed ? "border-brand-blue text-brand-blue" : "border-border-soft text-ink-soft"}`}><option value={g.className}>Retain ({g.className})</option>{opts.map((c) => <option key={c} value={c}>{c === "Graduated" ? "🎓 Graduate" : c}</option>)}</select></td>
                  </tr>); })}</tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
