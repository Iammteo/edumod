"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getStudentCredentials, resetStudentPasswords, type StudentCredential } from "@/lib/actions/students";
import { StudentLink } from "./student-nav";
import { Button, Alert } from "./ui";

type S = { id: string; name: string; admissionNo: string; className?: string | null };
const clsOf = (s: { className?: string | null }) => s.className || "-";

// Student logins with their current (visible) passwords. Select students to reset, and print a sheet.
export function StudentCredentials({ students }: { students: S[] }) {
  const [scope, setScope] = useState("all");
  const [rows, setRows] = useState<StudentCredential[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const classes = useMemo(() => ["all", ...Array.from(new Set(students.map(clsOf))).filter((c) => c !== "-").sort()], [students]);

  const load = useCallback(async () => {
    setErr(null);
    const r = await getStudentCredentials({ className: scope === "all" ? undefined : scope });
    if ("error" in r) { setErr(r.error); setRows([]); return; }
    setRows(r.rows); setSel(new Set());
  }, [scope]);
  useEffect(() => { load(); }, [load]);

  const shown = rows ?? [];
  const allSel = shown.length > 0 && shown.every((r) => sel.has(r.id));
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel(allSel ? new Set() : new Set(shown.map((r) => r.id)));

  async function resetSelected() {
    if (sel.size === 0) return;
    if (!confirm(`Reset ${sel.size} student login${sel.size === 1 ? "" : "s"}? Their current passwords stop working.`)) return;
    setBusy(true); setErr(null); setNote(null);
    const r = await resetStudentPasswords({ studentIds: [...sel] });
    setBusy(false);
    if ("error" in r) { setErr(r.error); return; }
    setNote(`${r.credentials.length} login${r.credentials.length === 1 ? "" : "s"} reset.`);
    load();
  }

  function printSheet() {
    const list = (sel.size > 0 ? shown.filter((r) => sel.has(r.id)) : shown);
    const esc = (s: string) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]!));
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Student logins</title></head><body style="font-family:Arial,sans-serif;color:#10213f">
      <h2 style="margin:0 0 4px">Student login credentials</h2><p style="color:#5b6b86;margin:0 0 14px">${scope === "all" ? "All classes" : esc(scope)} · ${list.length} students · generated ${new Date().toLocaleDateString()}</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr>
        ${["Name", "Class", "Student ID", "Password"].map((h) => `<th style="text-align:left;border:1px solid #ccc;padding:6px 10px;background:#eef2f9">${h}</th>`).join("")}
      </tr></thead><tbody>
        ${list.map((r) => `<tr><td style="border:1px solid #ccc;padding:6px 10px">${esc(r.name)}</td><td style="border:1px solid #ccc;padding:6px 10px">${esc(r.className ?? "-")}</td><td style="border:1px solid #ccc;padding:6px 10px;font-weight:bold">${esc(r.admissionNo)}</td><td style="border:1px solid #ccc;padding:6px 10px;font-family:monospace">${esc(r.password ?? "—")}</td></tr>`).join("")}
      </tbody></table>
      <p style="color:#8a94a6;margin-top:14px;font-size:11px">Students log in with the school code + Student ID + password.</p></body></html>`;
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(html + "<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>"); w.document.close();
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1"><span className="text-[11px] font-extrabold text-ink">Class</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="min-h-9 rounded-[9px] border border-border-soft bg-paper/60 px-2.5 text-[12px] outline-none focus:border-brand-blue">{classes.map((c) => <option key={c} value={c}>{c === "all" ? "All classes" : c}</option>)}</select>
        </label>
        <Button onClick={printSheet} variant="secondary" size="sm" disabled={shown.length === 0}>⤓ Print {sel.size > 0 ? `selected (${sel.size})` : "all"}</Button>
        <Button onClick={resetSelected} variant="primary" size="sm" disabled={busy || sel.size === 0}>{busy ? "Resetting…" : `Reset selected${sel.size > 0 ? ` (${sel.size})` : ""}`}</Button>
      </div>
      {err && <p className="text-[12px] font-bold text-danger">{err}</p>}
      {note && <Alert tone="success">{note}</Alert>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] text-left text-[12px]">
          <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="py-2 pr-2"><input type="checkbox" checked={allSel} onChange={toggleAll} className="size-3.5 accent-brand-blue" /></th><th className="py-2 font-bold">Student</th><th className="py-2 font-bold">Class</th><th className="py-2 font-bold">Student ID</th><th className="py-2 font-bold">Password</th></tr></thead>
          <tbody>
            {rows === null ? <tr><td colSpan={5} className="py-6 text-center text-ink-soft">Loading…</td></tr>
              : shown.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-ink-soft">No students in this class.</td></tr>
              : shown.map((s) => (
                <tr key={s.id} className={`border-b border-border-soft last:border-0 ${sel.has(s.id) ? "bg-brand-soft/30" : ""}`}>
                  <td className="py-2 pr-2"><input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)} className="size-3.5 accent-brand-blue" /></td>
                  <td className="py-2 font-bold text-ink"><StudentLink studentId={s.id} name={s.name} /></td>
                  <td className="py-2 text-ink-soft">{s.className ?? "-"}</td>
                  <td className="py-2"><code className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand-blue">{s.admissionNo}</code></td>
                  <td className="py-2">{s.password ? <code className="select-all text-[12px] font-extrabold text-ink">{s.password}</code> : <span className="text-[11px] text-ink-soft">— <span className="text-[10px]">reset to set</span></span>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {shown.length >= 500 && <p className="text-[11px] text-ink-soft">Showing the first 500 students. Filter by class to see the rest.</p>}
    </div>
  );
}
