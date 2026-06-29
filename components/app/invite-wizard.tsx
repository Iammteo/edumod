"use client";

import { useMemo, useState } from "react";
import { inviteStaff, type StaffRole } from "@/lib/actions/people";
import { AREAS, AREA_LABELS, LEVELS, ROLES, buildMatrix, buildSummary, type Area, type Level, type RoleKey } from "@/lib/permissions";
import { useClassNames } from "@/components/app/use-classes";

const SUBJECTS = ["English Language", "Mathematics", "Literature", "Physics", "Chemistry", "Biology", "Further Maths", "Civic Education", "Economics", "Geography", "Basic Science", "Social Studies"];
const EMPLOYMENT = ["Full-time", "Part-time", "Contract"];
const STEPS = ["Staff details", "Teaching responsibilities", "Access summary", "Review & send"];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!on)} className={`relative h-6 w-11 rounded-full transition ${on ? "bg-brand-blue" : "bg-[#cdd7e6]"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} /></button>;
}
function Chips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return <div className="flex flex-wrap gap-1.5">{options.map((o) => { const on = value.includes(o); return <button type="button" key={o} onClick={() => toggle(o)} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${on ? "border-brand-blue bg-brand-soft text-brand-blue" : "border-border-soft bg-white text-ink-soft hover:border-brand-blue/40"}`}>{o}{on && " ✓"}</button>; })}</div>;
}
function FieldLabel({ children }: { children: React.ReactNode }) { return <span className="text-[11px] font-extrabold text-ink">{children}</span>; }
const inputCls = "min-h-10 w-full rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] text-ink outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20";

export function InviteWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"form" | "sending" | "done" | "error">("form");
  const [err, setErr] = useState<string | null>(null);
  const [issuedStaffId, setIssuedStaffId] = useState<string>("");
  const CLASSES = useClassNames();
  const [f, setF] = useState({
    name: "", email: "", employmentType: "Full-time", role: "teacher" as RoleKey, startDate: "", staffId: "",
    isTeacher: true, isClassTeacher: false, assignedClass: "", subjects: [] as string[], teachingClasses: [] as string[],
    canApprovePayments: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const resp = { role: f.role, isTeacher: f.isTeacher, isClassTeacher: f.isClassTeacher, assignedClass: f.assignedClass, subjects: f.subjects, teachingClasses: f.teachingClasses, canApprovePayments: f.canApprovePayments };
  const matrix = useMemo(() => buildMatrix(resp), [f.role, f.isTeacher, f.isClassTeacher, f.canApprovePayments]); // eslint-disable-line react-hooks/exhaustive-deps
  const [perm, setPerm] = useState<Record<Area, Level>>(matrix);
  // keep editable matrix in sync when the suggestion changes
  const matrixKey = JSON.stringify(matrix);
  const [lastKey, setLastKey] = useState(matrixKey);
  if (matrixKey !== lastKey) { setLastKey(matrixKey); setPerm(matrix); }
  const summary = useMemo(() => buildSummary(resp), [f.role, f.isTeacher, f.isClassTeacher, f.subjects, f.teachingClasses, f.canApprovePayments, f.assignedClass]); // eslint-disable-line react-hooks/exhaustive-deps
  const academic = ROLES.find((r) => r.key === f.role)?.academic;
  const visibleSteps = academic ? STEPS : [STEPS[0], STEPS[2], STEPS[3]];

  function next() { if (step < 3) setStep(step + (academic ? 1 : step === 0 ? 2 : 1)); }
  function back() { if (step > 0) setStep(step - (academic ? 1 : step === 2 ? 2 : 1)); }

  async function send() {
    setPhase("sending"); setErr(null);
    const r = await inviteStaff({ name: f.name, email: f.email, employmentType: f.employmentType, role: f.role as StaffRole, startDate: f.startDate || undefined, staffId: f.staffId || undefined, isTeacher: f.isTeacher, isClassTeacher: f.isClassTeacher, assignedClass: f.assignedClass || undefined, subjects: f.subjects, teachingClasses: f.teachingClasses, canApprovePayments: f.canApprovePayments, permissions: perm });
    if ("error" in r) { setErr(r.error); setPhase("error"); return; }
    setIssuedStaffId(r.staffId);
    setPhase("done");
  }

  if (phase === "done") return <Result icon="✓" tone="green" title="Invitation sent successfully" body={`${f.name || "Your staff member"} will receive an email to set a password and complete their profile. They can sign in with the Staff ID below or their email.`} highlight={issuedStaffId ? { label: "Staff ID", value: issuedStaffId } : undefined} primary={["Invite another", () => { setF({ ...f, name: "", email: "", staffId: "" }); setStep(0); setPhase("form"); }]} secondary={["View staff", onDone]} />;
  if (phase === "error") return <Result icon="!" tone="red" title="We couldn't send the invitation" body={err || "The email may be invalid or the connection was interrupted. Your details are saved."} primary={["Try again", send]} secondary={["Edit details", () => setPhase("form")]} />;
  if (phase === "sending") return <div className="grid place-items-center rounded-2xl border border-border-soft bg-white py-24 text-center"><div className="mb-4 text-4xl motion-safe:animate-[float_2s_ease-in-out_infinite]">✈️</div><h2 className="font-display text-[20px] font-semibold">Sending invitation…</h2><p className="mt-1 text-[13px] text-ink-soft">Preparing secure access for {f.name || "your staff member"}.</p></div>;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div><h1 className="font-display text-[clamp(21px,3.5vw,28px)] font-semibold">Invite staff member</h1><p className="mt-0.5 text-[13px] text-ink-soft">Add a staff member and define their responsibilities and access.</p></div>
        <button onClick={onClose} className="rounded-[10px] border border-border-soft px-3.5 py-2 text-[12px] font-extrabold text-ink-soft transition hover:text-brand-blue">Cancel</button>
      </div>

      {/* Stepper */}
      <div className="mb-5 flex flex-wrap gap-2">{STEPS.map((s, i) => { const disabled = !academic && i === 1; return <div key={s} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${i === step ? "border-brand-blue bg-brand-soft" : "border-border-soft bg-white"} ${disabled ? "opacity-40" : ""}`}><span className={`grid size-5 place-items-center rounded-full text-[10px] font-bold ${i < step ? "bg-brand-green text-white" : i === step ? "bg-brand-blue text-white" : "bg-[#e4ebf6] text-ink-soft"}`}>{i < step ? "✓" : i + 1}</span><span className="text-[12px] font-bold text-ink">{s}</span></div>; })}</div>

      <div className="grid gap-[18px] lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border-soft bg-white p-5">
          {step === 0 && <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5"><FieldLabel>Full name</FieldLabel><input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Mrs. Grace Samuel" /></label><label className="grid gap-1.5"><FieldLabel>Work email</FieldLabel><input className={inputCls} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="grace@school.edu.ng" /></label></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5"><FieldLabel>Employment type</FieldLabel><select className={inputCls} value={f.employmentType} onChange={(e) => set("employmentType", e.target.value)}>{EMPLOYMENT.map((x) => <option key={x}>{x}</option>)}</select></label><label className="grid gap-1.5"><FieldLabel>Job role</FieldLabel><select className={inputCls} value={f.role} onChange={(e) => set("role", e.target.value as RoleKey)}>{ROLES.filter((r) => r.key !== "school_admin").map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5"><FieldLabel>Start date</FieldLabel><input className={inputCls} type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></label><label className="grid gap-1.5"><FieldLabel>Staff ID (optional)</FieldLabel><input className={inputCls} value={f.staffId} onChange={(e) => set("staffId", e.target.value)} placeholder="STF-001" /></label></div>
          </div>}

          {step === 1 && academic && <div className="grid gap-5">
            <div className="flex items-center justify-between rounded-xl border border-border-soft p-3.5"><div><FieldLabel>Is this person a teacher?</FieldLabel><p className="text-[11px] text-ink-soft">They teach subjects to classes.</p></div><Toggle on={f.isTeacher} onChange={(v) => set("isTeacher", v)} /></div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]"><div className="flex items-center justify-between rounded-xl border border-border-soft p-3.5"><div><FieldLabel>Class teacher?</FieldLabel><p className="text-[11px] text-ink-soft">Owns a class register.</p></div><Toggle on={f.isClassTeacher} onChange={(v) => set("isClassTeacher", v)} /></div>{f.isClassTeacher && <label className="grid gap-1.5"><FieldLabel>Assigned class</FieldLabel><select className={inputCls} value={f.assignedClass} onChange={(e) => set("assignedClass", e.target.value)}><option value="">Select a class…</option>{CLASSES.map((c) => <option key={c}>{c}</option>)}</select></label>}</div>
            <div className="grid gap-1.5"><FieldLabel>Assigned subjects</FieldLabel><Chips options={SUBJECTS} value={f.subjects} onChange={(v) => set("subjects", v)} /></div>
            <div className="grid gap-1.5"><FieldLabel>Teaching classes / streams</FieldLabel><Chips options={CLASSES} value={f.teachingClasses} onChange={(v) => set("teachingClasses", v)} /></div>
          </div>}

          {step === 2 && <div className="grid gap-4">
            <p className="text-[13px] text-ink-soft">Edumod suggested this access based on the role and responsibilities. Adjust if needed.</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[380px] text-left text-[12px]"><thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="py-2 font-bold">Area</th><th className="py-2 font-bold">Access</th></tr></thead><tbody>{AREAS.map((a) => <tr key={a} className="border-b border-border-soft last:border-0"><td className="py-2.5 font-bold text-ink">{AREA_LABELS[a]}</td><td className="py-2.5"><select value={perm[a]} onChange={(e) => setPerm({ ...perm, [a]: e.target.value as Level })} className="rounded-lg border border-border-soft bg-white px-2 py-1 text-[11px] font-bold"><option value="none">No access</option>{LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}</select></td></tr>)}</tbody></table></div>
            <label className="flex items-center justify-between rounded-xl border border-[#f3d9a8] bg-[#fdf6e9] p-3.5"><div><FieldLabel>Can approve payments</FieldLabel><p className="text-[11px] text-ink-soft">They can approve payments recorded by others - never their own.</p></div><Toggle on={f.canApprovePayments} onChange={(v) => set("canApprovePayments", v)} /></label>
          </div>}

          {step === 3 && <div className="grid gap-3 text-[13px]">
            <h3 className="font-display text-[16px] font-semibold">Review &amp; send</h3>
            {[["Name", f.name || "-"], ["Email", f.email || "-"], ["Role", ROLES.find((r) => r.key === f.role)?.label], ["Employment", f.employmentType], ["Class teacher", f.isClassTeacher ? `Yes · ${f.assignedClass || "-"}` : "No"], ["Subjects", f.subjects.join(", ") || "-"], ["Teaching classes", f.teachingClasses.join(", ") || "-"], ["Approve payments", f.canApprovePayments ? "Yes" : "No"]].map(([k, v]) => <div key={k as string} className="flex justify-between gap-4 border-b border-border-soft py-2 last:border-0"><span className="font-bold text-ink-soft">{k}</span><span className="text-right font-bold text-ink">{v}</span></div>)}
          </div>}

          <div className="mt-6 flex items-center justify-between">
            <button onClick={step === 0 ? onClose : back} className="rounded-[10px] border border-border-soft px-4 py-2 text-[13px] font-extrabold text-ink-soft transition hover:text-brand-blue">{step === 0 ? "Cancel" : "← Back"}</button>
            {step < 3 ? <button onClick={next} disabled={step === 0 && (!f.name || !f.email)} className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-blue px-5 py-2 text-[13px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark disabled:opacity-50">Next →</button> : <button onClick={send} className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-blue px-5 py-2 text-[13px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark">Send invitation ✈</button>}
          </div>
        </div>

        {/* Live access summary */}
        <aside className="h-fit rounded-2xl border border-border-soft bg-white p-5">
          <div className="flex items-center justify-between"><h3 className="font-display text-[15px] font-semibold">Access summary</h3><span className="grid size-6 place-items-center rounded-full bg-brand-green/10 text-brand-green">🛡</span></div>
          <p className="mt-1 text-[11px] text-ink-soft">Updates live as you choose role and responsibilities.</p>
          <dl className="mt-3 grid gap-2 text-[11px]">{[["Role", ROLES.find((r) => r.key === f.role)?.label], ["Employment", f.employmentType], ["Teaching", f.subjects.join(", ") || "-"], ["Classes", (f.isClassTeacher ? [f.assignedClass, ...f.teachingClasses] : f.teachingClasses).filter(Boolean).join(", ") || "-"]].map(([k, v]) => <div key={k as string} className="flex justify-between gap-3"><dt className="font-bold text-ink-soft">{k}</dt><dd className="text-right font-bold text-ink">{v}</dd></div>)}</dl>
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-extrabold text-ink">They can</p>
            <ul className="grid gap-1">{summary.can.map((c) => <li key={c} className="flex gap-1.5 text-[11px] text-ink-soft"><span className="text-brand-green">✓</span>{c}</li>)}</ul>
            {summary.cannot.length > 0 && <><p className="mb-1.5 mt-3 text-[11px] font-extrabold text-ink">They cannot</p><ul className="grid gap-1">{summary.cannot.map((c) => <li key={c} className="flex gap-1.5 text-[11px] text-ink-soft"><span className="text-[#b3261e]">✕</span>{c}</li>)}</ul></>}
          </div>
          <p className="mt-4 rounded-lg bg-brand-soft/60 p-2.5 text-[10px] leading-relaxed text-ink-soft">Permissions are role-based and scoped to the assigned subjects and classes.</p>
        </aside>
      </div>
    </div>
  );
}

function Result({ icon, tone, title, body, highlight, primary, secondary }: { icon: string; tone: "green" | "red"; title: string; body: string; highlight?: { label: string; value: string }; primary: [string, () => void]; secondary: [string, () => void] }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-border-soft bg-white py-16 text-center motion-safe:animate-[fade-up_.4s_ease]">
      <div className={`mb-4 grid size-16 place-items-center rounded-full text-3xl ${tone === "green" ? "bg-brand-green/10 text-brand-green" : "bg-[#fdeeee] text-[#b3261e]"}`}>{icon}</div>
      <h2 className="font-display text-[22px] font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-soft">{body}</p>
      {highlight && <div className="mt-4 inline-flex items-center gap-2 rounded-[12px] border border-brand-soft bg-brand-soft/40 px-4 py-2.5"><span className="text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">{highlight.label}</span><code className="select-all font-display text-[18px] font-bold tracking-wide text-brand-blue">{highlight.value}</code><button type="button" onClick={() => navigator.clipboard?.writeText(highlight.value)} className="rounded-md px-2 py-1 text-[11px] font-extrabold text-brand-blue transition hover:bg-white" title="Copy">Copy</button></div>}
      <div className="mt-5 flex gap-2.5"><button onClick={primary[1]} className="rounded-[10px] bg-brand-blue px-5 py-2.5 text-[13px] font-extrabold text-white transition hover:bg-brand-dark">{primary[0]}</button><button onClick={secondary[1]} className="rounded-[10px] border border-border-soft px-5 py-2.5 text-[13px] font-extrabold text-ink-soft transition hover:text-brand-blue">{secondary[0]}</button></div>
    </div>
  );
}
