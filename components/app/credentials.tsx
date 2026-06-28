"use client";

import { useState } from "react";
import { bulkResetPasswords, type Credential } from "@/lib/actions/students";

type S = { id: string; name: string; admissionNo: string; className?: string | null };
const clsOf = (s: S) => s.className || "—";

export function StudentCredentials({ students }: { students: S[] }) {
  const [scope, setScope] = useState("all");
  const [creds, setCreds] = useState<Credential[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const classes = ["all", ...Array.from(new Set(students.map(clsOf))).filter((c) => c !== "—").sort()];
  const inScope = students.filter((s) => scope === "all" || clsOf(s) === scope);

  async function reset() {
    if (!confirm(`Reset logins for ${scope === "all" ? "ALL students" : scope}? Their current passwords stop working.`)) return;
    setBusy(true); setErr(null);
    const r = await bulkResetPasswords({ className: scope === "all" ? undefined : scope });
    setBusy(false);
    if ("error" in r) { setErr(r.error); return; }
    setCreds(r.credentials);
  }

  function printSheet() {
    const rows = (creds ?? inScope.map((s) => ({ name: s.name, studentId: s.admissionNo, password: "—", className: clsOf(s) })));
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Student logins</title></head><body style="font-family:Arial,sans-serif;color:#10213f">
      <h2 style="margin:0 0 4px">Student login credentials</h2><p style="color:#5b6b86;margin:0 0 14px">${scope === "all" ? "All classes" : scope} · ${rows.length} students · generated ${new Date().toLocaleDateString()}</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr>
        ${["Name", "Class", "Student ID", "Password"].map((h) => `<th style="text-align:left;border:1px solid #ccc;padding:6px 10px;background:#eef2f9">${h}</th>`).join("")}
      </tr></thead><tbody>
        ${rows.map((r) => `<tr><td style="border:1px solid #ccc;padding:6px 10px">${r.name}</td><td style="border:1px solid #ccc;padding:6px 10px">${r.className ?? "—"}</td><td style="border:1px solid #ccc;padding:6px 10px;font-weight:bold">${r.studentId}</td><td style="border:1px solid #ccc;padding:6px 10px;font-family:monospace">${r.password}</td></tr>`).join("")}
      </tbody></table>
      <p style="color:#8a94a6;margin-top:14px;font-size:11px">Students log in with the school code + Student ID + password.</p></body></html>`;
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(html + "<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>"); w.document.close();
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1"><span className="text-[11px] font-extrabold text-ink">Scope</span>
          <select value={scope} onChange={(e) => { setScope(e.target.value); setCreds(null); }} className="min-h-9 rounded-[9px] border border-border-soft bg-paper/60 px-2.5 text-[12px] outline-none focus:border-brand-blue">{classes.map((c) => <option key={c} value={c}>{c === "all" ? "All classes" : c}</option>)}</select>
        </label>
        <button onClick={printSheet} className="inline-flex min-h-9 items-center rounded-[10px] border border-border-soft bg-white px-3.5 text-[12px] font-extrabold text-ink transition hover:border-brand-blue">⤓ Print ID sheet</button>
        <button onClick={reset} disabled={busy} className="inline-flex min-h-9 items-center rounded-[10px] bg-brand-blue px-3.5 text-[12px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-60">{busy ? "Resetting…" : "Reset & reveal passwords"}</button>
      </div>
      {err && <p className="text-[12px] font-bold text-[#b3261e]">{err}</p>}
      {creds && <div className="rounded-[10px] border border-brand-blue/30 bg-brand-soft/30 p-2.5 text-[11px] font-bold text-brand-blue">{creds.length} passwords reset — shown once below. Print now; they won&rsquo;t be shown again.</div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-[12px]">
          <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="py-2 font-bold">Student</th><th className="py-2 font-bold">Class</th><th className="py-2 font-bold">Student ID</th><th className="py-2 font-bold">Password</th></tr></thead>
          <tbody>
            {creds ? creds.map((c, i) => <tr key={i} className="border-b border-border-soft last:border-0"><td className="py-2 font-bold text-ink">{c.name}</td><td className="py-2 text-ink-soft">{c.className ?? "—"}</td><td className="py-2"><code className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand-blue">{c.studentId}</code></td><td className="py-2"><code className="select-all text-[12px] font-extrabold text-ink">{c.password}</code></td></tr>)
              : inScope.length === 0 ? <tr><td colSpan={4} className="py-6 text-center text-ink-soft">No students in this scope.</td></tr>
              : inScope.map((s) => <tr key={s.id} className="border-b border-border-soft last:border-0"><td className="py-2 font-bold text-ink">{s.name}</td><td className="py-2 text-ink-soft">{clsOf(s)}</td><td className="py-2"><code className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand-blue">{s.admissionNo}</code></td><td className="py-2 text-ink-soft">•••••• <span className="text-[10px]">(reset to reveal)</span></td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
