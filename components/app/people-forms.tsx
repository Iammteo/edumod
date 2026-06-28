"use client";

import { useState } from "react";
import { createStudent, resetStudentPassword } from "@/lib/actions/people";
import { useClassNames } from "@/components/app/use-classes";

function Field({ label, name, type = "text", placeholder }: { label: string; name: string; type?: string; placeholder: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-extrabold text-ink">{label}</span>
      <input name={name} type={type} placeholder={placeholder} required className="min-h-10 rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] text-ink outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
    </label>
  );
}

function Submit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return <button type="submit" disabled={busy} className="mt-1 inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] bg-brand-blue px-4 text-[13px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark disabled:opacity-70">{busy ? <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : children}</button>;
}

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="text-[11px] font-bold text-[#b3261e]">{msg}</p> : null;
}

// One-time credential display — admin/teacher copies these before they're gone.
function Credentials({ title, rows, note }: { title: string; rows: [string, string][]; note: string }) {
  return (
    <div className="rounded-[10px] border border-brand-blue/30 bg-brand-soft/40 p-3 motion-safe:animate-[fade-up_.3s_ease]">
      <p className="text-[11px] font-extrabold text-brand-blue">{title}</p>
      <div className="mt-2 grid gap-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">{k}</span>
            <code className="select-all text-[13px] font-extrabold text-ink">{v}</code>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-ink-soft">{note}</p>
    </div>
  );
}

export function AddStudentForm() {
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ studentId: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const classNames = useClassNames();
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true); setError(null); setCreated(null);
    const r = await createStudent({ name: String(fd.get("name") || ""), className: String(fd.get("className") || "") });
    setBusy(false);
    if ("error" in r) { setError(r.error); return; }
    setCreated({ studentId: r.studentId, password: r.password });
    form.reset();
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <Field label="Student's name" name="name" placeholder="Chiamaka Nwosu" />
      <label className="grid gap-1.5">
        <span className="text-[11px] font-extrabold text-ink">Class</span>
        <select name="className" defaultValue="" className="min-h-10 rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] text-ink outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20">
          <option value="">No class yet</option>
          {classNames.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <Submit busy={busy}>Create student</Submit>
      <Err msg={error} />
      {created && <Credentials title="Student created — share these now" rows={[["Student ID", created.studentId], ["Password", created.password]]} note="The password is shown once. They log in with your school code + Student ID + this password." />}
    </form>
  );
}

export function ResetStudentPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ studentName: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true); setError(null); setResult(null);
    const r = await resetStudentPassword({ studentId: String(fd.get("studentId") || "") });
    setBusy(false);
    if ("error" in r) { setError(r.error); return; }
    setResult({ studentName: r.studentName, password: r.password });
    form.reset();
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <Field label="Student ID" name="studentId" placeholder="2623844" />
      <Submit busy={busy}>Reset password</Submit>
      <Err msg={error} />
      {result && <Credentials title={`New password for ${result.studentName}`} rows={[["Password", result.password]]} note="Shown once — hand it over now." />}
    </form>
  );
}
