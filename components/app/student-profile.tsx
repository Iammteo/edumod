"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStudentProfile, updateStudentProfile, uploadStudentPhoto, regenerateStudentPassword, getStudentPassword, removeStudent, type StudentProfile } from "@/lib/actions/students";
import { LoadingPanel, LoadError } from "./skeleton";
import { requestRefund, carryForwardCredit, decideRefund } from "@/lib/actions/refunds";
import { StudentProfileEdit } from "./student-profile-edit";
import { StudentResults } from "./student-results";
import { Button, Alert } from "./ui";

const naira = (n: number) => `₦${n.toLocaleString()}`;
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const AV = ["#2159e8", "#178a4c", "#b9540f", "#6b2fb3", "#0f8a8a", "#c0392b"];
function age(dob: string) { if (!dob) return ""; const d = new Date(dob); if (isNaN(+d)) return ""; const a = Math.floor((Date.now() - +d) / (365.25 * 864e5)); return a > 0 && a < 120 ? `${a} yrs` : ""; }
const gradeTone = (g: string) => (g === "A" ? "text-brand-green" : g === "F" ? "text-danger" : g === "D" || g === "E" ? "text-warn" : "text-brand-blue");
function ord(n: number) { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
const TABS = ["Overview", "Guardian", "Medical", "Finance", "Academics", "Notes"] as const;
type Tab = typeof TABS[number];

export function StudentProfilePage({ studentId, onBack, onChanged }: { studentId: string; onBack: () => void; onChanged?: () => void }) {
  const [data, setData] = useState<StudentProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [editing, setEditing] = useState(false);
  const [pwd, setPwd] = useState<string | null>(null);
  const [pwdFresh, setPwdFresh] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await getStudentProfile(studentId);
    if ("error" in r) setErr(r.error);
    else { setData(r); setErr(null); }
  }, [studentId]);
  useEffect(() => { load(); }, [load]);

  async function onPhoto(file: File) {
    const fd = new FormData(); fd.set("studentId", studentId); fd.set("photo", file);
    const r = await uploadStudentPhoto(fd);
    if ("error" in r) setErr(r.error); else { load(); onChanged?.(); }
  }
  async function resetPwd() {
    if (!confirm(`Reset ${data?.name}'s password? Their current password will stop working.`)) return;
    setErr(null); setPwd(null);
    const r = await regenerateStudentPassword(studentId);
    if ("error" in r) setErr(r.error); else { setPwd(r.password); setPwdFresh(true); }
  }
  async function showPwd() {
    setErr(null); setPwd(null);
    const r = await getStudentPassword(studentId);
    if ("error" in r) { setErr(r.error); return; }
    if (!r.password) { setErr("No saved password for this student yet. Reset the password once to make it viewable."); return; }
    setPwd(r.password); setPwdFresh(false);
  }
  async function remove() {
    if (!confirm(`Permanently remove ${data?.name}? This deletes their record and login.`)) return;
    setErr(null);
    const r = await removeStudent(studentId);
    if ("error" in r) setErr(r.error); else { onChanged?.(); onBack(); }
  }

  if (!data) return err ? <LoadError message={err} onRetry={load} /> : <LoadingPanel stats={2} />;
  const b = data.bio, f = data.financial;

  return (
    <>
      <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 text-[12px] text-ink-soft"><button onClick={onBack} className="font-extrabold text-brand-blue hover:underline">Students</button><span>›</span><span className="font-bold text-ink">Student profile</span></div>
        <div className="flex flex-wrap gap-2">
          {data.canManage && <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>✎ Edit profile</Button>}
          {data.canManage && <Button variant="secondary" size="sm" onClick={showPwd}>👁 Show password</Button>}
          {data.canManage && <Button variant="secondary" size="sm" onClick={resetPwd}>🔑 Reset password</Button>}
          {data.canRemove && <Button variant="danger" size="sm" onClick={remove}>Remove</Button>}
          <Button size="sm" onClick={() => setTab("Finance")}>₦ Finance record</Button>
        </div>
      </div>
      {err && <Alert tone="error" className="mb-3">{err}</Alert>}
      {pwd && <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-brand-blue/30 bg-brand-soft/40 px-3.5 py-2.5"><span className="text-[12px] font-bold text-ink">{pwdFresh ? "New password" : "Password"} for {data.name}: <code className="select-all rounded bg-white px-2 py-0.5 text-[13px] font-extrabold text-brand-blue">{pwd}</code>{pwdFresh ? " - share it now." : ""}</span><button onClick={() => setPwd(null)} className="text-[12px] font-extrabold text-brand-blue hover:underline">Hide</button></div>}

      {/* Header card */}
      <div className="rounded-2xl border border-border-soft bg-white p-5">
        <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="relative mx-auto shrink-0 sm:mx-0">
              <span className="grid size-24 place-items-center overflow-hidden rounded-full text-[28px] font-extrabold text-white" style={{ backgroundColor: AV[data.name.length % AV.length] }}>{data.photoKey ? <img src={data.photoKey} alt="" className="size-full object-cover" /> : initials(data.name)}</span>
              {data.canManage && <><button onClick={() => fileRef.current?.click()} className="absolute -bottom-1.5 -right-1.5 grid size-8 place-items-center rounded-full border-2 border-white bg-brand-blue text-white shadow" title="Change photo">📷</button><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const fl = e.target.files?.[0]; if (fl) onPhoto(fl); }} /></>}
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start"><h1 className="font-display text-[22px] font-semibold leading-tight">{data.name}</h1><span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-extrabold text-brand-green">Active</span></div>
              <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2.5 text-left sm:grid-cols-3">
                <Fact k="Admission no." v={data.admissionNo} />
                <Fact k="Class" v={data.className ?? "-"} />
                <Fact k="Arm" v={b.arm || "-"} />
                <Fact k="House" v={b.house || "-"} />
                <Fact k="Date of birth" v={b.dateOfBirth ? `${b.dateOfBirth}${age(b.dateOfBirth) ? ` (${age(b.dateOfBirth)})` : ""}` : "-"} />
                <Fact k="Gender" v={b.sex || "-"} />
              </div>
              <p className="mt-3 text-[12px] text-ink-soft">📍 {b.address || "No address on file"}{data.enrolledOn ? `  ·  Enrolled ${data.enrolledOn}` : ""}</p>
            </div>
          </div>
          <QuickSummary data={data} />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-border-soft">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-[12px] font-extrabold transition ${tab === t ? "border-brand-blue text-brand-blue" : "border-transparent text-ink-soft hover:text-ink"}`}>{t === "Medical" ? "Medical & welfare" : t === "Guardian" ? "Guardian info" : t}</button>)}
      </div>

      <div className="mt-4">
        {tab === "Overview" && <OverviewTab data={data} goEdit={() => setEditing(true)} goTab={setTab} />}
        {tab === "Guardian" && <GuardianTab data={data} />}
        {tab === "Medical" && <MedicalTab data={data} />}
        {tab === "Finance" && <FinanceTab data={data} onChanged={load} onErr={setErr} />}
        {tab === "Academics" && <StudentResults studentId={studentId} academics={data.academics} canManage={data.canManage} onChanged={load} />}
        {tab === "Notes" && <NotesTab data={data} />}
      </div>

      {editing && <StudentProfileEdit data={data} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await load(); onChanged?.(); }} />}
    </>
  );
}

function Fact({ k, v }: { k: string; v: string }) { return <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">{k}</div><div className="text-[13px] font-bold text-ink">{v}</div></div>; }

function meter(label: string, value: string, note: string, tone: string) {
  return <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">{label}</div><div className="mt-0.5 font-display text-[20px] font-bold leading-none">{value}</div><div className="mt-1 inline-flex items-center gap-1 text-[10px] font-extrabold" style={{ color: tone }}><span className="size-1.5 rounded-full" style={{ backgroundColor: tone }} />{note}</div></div>;
}
function QuickSummary({ data }: { data: StudentProfile }) {
  const s = data.summary, f = data.financial;
  const paidPct = f.invoiced ? Math.round((f.paid / f.invoiced) * 100) : 0;
  return (
    <div className="rounded-2xl border border-border-soft bg-paper/40 p-4">
      <div className="mb-3 flex items-center gap-1.5 text-[12px] font-extrabold"><span className="text-brand-green">◆</span>Quick summary</div>
      <div className="grid grid-cols-3 gap-3">
        {meter("Current average", s.average != null ? `${s.average}%` : "-", s.average != null ? gradeWord(s.average) : "No results", s.average != null ? "#178a4c" : "#8d98aa")}
        {meter("Class position", s.position ? `${s.position} / ${s.classSize}` : "-", s.position && s.classSize ? `Top ${Math.max(1, Math.round((s.position / s.classSize) * 100))}%` : "-", "#2159e8")}
        {meter("Fees paid", `${paidPct}%`, f.outstanding > 0 ? `${naira(f.outstanding)} owing` : "Cleared", f.outstanding > 0 ? "#b9540f" : "#178a4c")}
      </div>
    </div>
  );
}
function gradeWord(avg: number) { return avg >= 70 ? "Excellent" : avg >= 60 ? "Very good" : avg >= 50 ? "Good" : avg >= 45 ? "Fair" : "Needs support"; }

/* ---------- Cards ---------- */
function Card({ title, action, children, tone }: { title: string; action?: React.ReactNode; children: React.ReactNode; tone?: "amber" }) {
  return <section className={`rounded-2xl border p-4 ${tone === "amber" ? "border-warn-line bg-warn-soft" : "border-border-soft bg-white"}`}><div className="mb-2.5 flex items-center justify-between"><h3 className="flex items-center gap-1.5 font-display text-[14px] font-semibold">{title}</h3>{action}</div>{children}</section>;
}
function Row({ k, v }: { k: string; v: string }) { return <div className="flex justify-between gap-4 border-b border-border-soft py-2 last:border-0"><dt className="text-[12px] font-bold text-ink-soft">{k}</dt><dd className="max-w-[60%] text-right text-[12px] font-bold text-ink">{v || "-"}</dd></div>; }

function OverviewTab({ data, goEdit, goTab }: { data: StudentProfile; goEdit: () => void; goTab: (t: Tab) => void }) {
  const b = data.bio, f = data.financial;
  const hasMedical = b.medicalNotes || b.allergies || b.specialSupport;
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <Card title="🧑 Personal details" action={data.canManage ? <button onClick={goEdit} className="text-[11px] font-extrabold text-brand-blue hover:underline">Edit</button> : undefined}>
        <dl className="grid gap-0">
          <Row k="Full name" v={data.name} /><Row k="Admission no." v={data.admissionNo} /><Row k="Date of birth" v={b.dateOfBirth} /><Row k="Gender" v={b.sex} /><Row k="Class & Arm" v={[data.className, b.arm].filter(Boolean).join(" · ")} /><Row k="House" v={b.house} /><Row k="Religion" v={b.religion} /><Row k="State / LGA" v={[b.stateOfOrigin, b.lga].filter(Boolean).join(" / ")} /><Row k="Address" v={b.address} /><Row k="Enrolled on" v={data.enrolledOn} />
        </dl>
      </Card>

      <div className="grid content-start gap-4">
        {hasMedical && <Card title="⚠ Medical note" tone="amber"><p className="text-[13px] font-bold text-warn">{b.medicalNotes || b.allergies}</p>{b.medicalNotes && b.allergies && <p className="mt-1 text-[12px] text-danger-deep">Allergies: {b.allergies}</p>}<button onClick={() => goTab("Medical")} className="mt-2.5 rounded-lg bg-warn px-3 py-1.5 text-[11px] font-extrabold text-white">View details</button></Card>}
        <Card title="💗 Welfare & support">
          <dl className="grid gap-0"><Row k="Allergies" v={b.allergies} /><Row k="Special support" v={b.specialSupport} /><Row k="Dietary notes" v={b.dietaryNotes} /><Row k="Blood group" v={b.bloodGroup} /><Row k="Genotype" v={b.genotype} /></dl>
        </Card>
      </div>

      <Card title="₦ Finance summary" action={<button onClick={() => goTab("Finance")} className="text-[11px] font-extrabold text-brand-blue hover:underline">View full finance</button>}>
        <div className="grid grid-cols-2 gap-2.5">
          <Mini label="Total assigned" v={naira(f.invoiced)} c="#2159e8" />
          <Mini label="Paid so far" v={naira(f.paid)} c="#178a4c" />
          <Mini label="Outstanding" v={naira(f.outstanding)} c="#b9540f" />
          <Mini label="Next due" v={f.nextDue ?? "-"} c="#6b2fb3" />
        </div>
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] font-extrabold text-ink-soft">Recent payments</div>
          {f.payments.length === 0 ? <p className="text-[12px] text-ink-soft">No payments yet.</p> : <ul className="grid gap-1">{f.payments.slice(0, 3).map((p) => <li key={p.id} className="flex items-center justify-between gap-2 text-[11px]"><span className="truncate text-ink-soft">{p.description || "Payment"} · {p.date}</span><span className="flex items-center gap-1.5"><strong className="text-ink">{naira(p.amount)}</strong>{p.status === "approved" && p.receiptKey && <a href={`/r/${p.receiptKey}`} target="_blank" rel="noreferrer" className="text-brand-blue hover:underline">↓</a>}</span></li>)}</ul>}
        </div>
      </Card>

      <Card title="👪 Guardians" action={<button onClick={() => goTab("Guardian")} className="text-[11px] font-extrabold text-brand-blue hover:underline">View all</button>}>
        {[data.bio.guardian1, data.bio.guardian2].filter((g) => g.name).slice(0, 2).map((g, i) => <div key={i} className="mb-2 last:mb-0"><div className="text-[11px] font-extrabold text-brand-blue">{g.relationship || "Guardian"}</div><div className="text-[12px] font-bold text-ink">{g.name}</div><div className="text-[11px] text-ink-soft">{[g.phone, g.email].filter(Boolean).join(" · ")}</div></div>)}
        {!data.bio.guardian1.name && !data.bio.guardian2.name && <p className="text-[12px] text-ink-soft">No guardian recorded yet.</p>}
        {data.bio.emergency.name && <div className="mt-2 rounded-lg bg-brand-soft/50 p-2.5 text-[11px]"><span className="font-extrabold text-brand-blue">Emergency:</span> {data.bio.emergency.name} ({data.bio.emergency.relationship}) · {data.bio.emergency.phone}</div>}
      </Card>

      <Card title="🎓 Academic snapshot" action={<button onClick={() => goTab("Academics")} className="text-[11px] font-extrabold text-brand-blue hover:underline">View full report</button>}>
        {data.academics.length === 0 ? <p className="text-[12px] text-ink-soft">No results recorded yet.</p> : <SubjectsMini t={data.academics[0]} />}
      </Card>

      {data.bio.notes && <Card title="📝 Notes & remarks"><p className="text-[12px] leading-relaxed text-ink-soft">{data.bio.notes}</p></Card>}
    </div>
  );
}
function Mini({ label, v, c }: { label: string; v: string; c: string }) { return <div className="rounded-xl border border-border-soft bg-paper/50 p-2.5"><div className="text-[10px] font-bold text-ink-soft">{label}</div><div className="mt-0.5 font-display text-[clamp(13px,3vw,16px)] font-bold leading-none" style={{ color: c }}>{v}</div></div>; }
function SubjectsMini({ t }: { t: StudentProfile["academics"][number] }) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-ink-soft"><span>{t.term}</span><span>Avg <strong className={gradeTone(t.grade)}>{t.average}%</strong>{t.position ? ` · ${ord(t.position)}/${t.classSize}` : ""}</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[260px] text-left text-[11px]"><thead><tr className="text-[9px] uppercase tracking-wide text-ink-soft"><th className="py-1 font-bold">Subject</th><th className="py-1 text-center font-bold">CA</th><th className="py-1 text-center font-bold">Exam</th><th className="py-1 text-center font-bold">Total</th><th className="py-1 text-center font-bold">Grade</th></tr></thead>
        <tbody>{t.subjects.slice(0, 6).map((su) => <tr key={su.subject} className="border-t border-border-soft"><td className="py-1.5 font-bold text-ink">{su.subject}</td><td className="py-1.5 text-center text-ink-soft">{su.ca}</td><td className="py-1.5 text-center text-ink-soft">{su.exam}</td><td className="py-1.5 text-center font-extrabold text-ink">{su.total}</td><td className={`py-1.5 text-center font-extrabold ${gradeTone(su.grade)}`}>{su.grade}</td></tr>)}</tbody></table></div>
    </>
  );
}

function GuardianTab({ data }: { data: StudentProfile }) {
  const gs = [data.bio.guardian1, data.bio.guardian2].filter((g) => g.name || g.phone);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {gs.length === 0 ? <Card title="👪 Guardians"><p className="text-[12px] text-ink-soft">No guardian details recorded yet.</p></Card> : gs.map((g, i) => (
        <Card key={i} title={`👤 ${g.relationship || `Guardian ${i + 1}`}`}><dl className="grid gap-0"><Row k="Name" v={g.name} /><Row k="Relationship" v={g.relationship} /><Row k="Phone" v={g.phone} /><Row k="Email" v={g.email} /><Row k="Occupation" v={g.occupation} /><Row k="Address" v={g.address} /></dl></Card>
      ))}
      <Card title="🚑 Emergency contact"><dl className="grid gap-0"><Row k="Name" v={data.bio.emergency.name} /><Row k="Relationship" v={data.bio.emergency.relationship} /><Row k="Phone" v={data.bio.emergency.phone} /></dl></Card>
    </div>
  );
}

function MedicalTab({ data }: { data: StudentProfile }) {
  const b = data.bio;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(b.medicalNotes || b.allergies) && <Card title="⚠ Medical alert" tone="amber"><dl className="grid gap-0"><Row k="Conditions" v={b.medicalNotes} /><Row k="Allergies" v={b.allergies} /></dl></Card>}
      <Card title="💗 Welfare & support"><dl className="grid gap-0"><Row k="Special support" v={b.specialSupport} /><Row k="Dietary notes" v={b.dietaryNotes} /><Row k="Blood group" v={b.bloodGroup} /><Row k="Genotype" v={b.genotype} /></dl></Card>
      {!b.medicalNotes && !b.allergies && !b.specialSupport && !b.dietaryNotes && !b.bloodGroup && !b.genotype && <Card title="Medical record"><p className="text-[12px] text-ink-soft">No medical information recorded yet. Use “Edit profile” to add it.</p></Card>}
    </div>
  );
}

function NotesTab({ data }: { data: StudentProfile }) {
  return <Card title="📝 Notes & remarks">{data.bio.notes ? <p className="text-[13px] leading-relaxed text-ink">{data.bio.notes}</p> : <p className="text-[12px] text-ink-soft">No notes recorded yet. Add notes via “Edit profile”.</p>}</Card>;
}

/* ---------- Overpayment / credit + refund ---------- */
function CreditPanel({ data, onChanged, onErr }: { data: StudentProfile; onChanged: () => void; onErr: (e: string) => void }) {
  const f = data.financial;
  const [mode, setMode] = useState<"none" | "refund">("none");
  const [amount, setAmount] = useState(String(f.credit));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = f.refunds.find((r) => r.status === "pending");
  const STEPS = ["Requested", "Under review", "Approved", "Completed"];
  const stepIndex = (s: string) => (s === "pending" ? 1 : s === "approved" ? 3 : s === "rejected" ? 1 : 0);

  async function carry() { setBusy(true); onErr(""); const r = await carryForwardCredit(data.id); setBusy(false); if ("error" in r) onErr(r.error); else onChanged(); }
  async function submitRefund() { setBusy(true); onErr(""); const r = await requestRefund({ studentId: data.id, amount: Number(amount || 0), reason }); setBusy(false); if ("error" in r) { onErr(r.error); return; } setMode("none"); setReason(""); onChanged(); }
  async function decide(id: string, ok: boolean) { setBusy(true); onErr(""); const r = await decideRefund(id, ok, ok ? "" : "Rejected"); setBusy(false); if ("error" in r) onErr(r.error); else onChanged(); }

  if (f.credit <= 0 && f.refunds.length === 0) return null;
  return (
    <div className="rounded-2xl border border-success-line bg-brand-green/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="flex items-center gap-1.5 text-[12px] font-extrabold text-brand-green">↑ Overpaid - credit balance</div><div className="mt-0.5 font-display text-[22px] font-bold text-brand-green">{naira(f.credit)}</div></div>
        {data.canManage && f.credit > 0 && !pending && mode === "none" && (
          <div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={carry} disabled={busy}>Carry forward to next term</Button><Button size="sm" onClick={() => setMode("refund")}>Request refund</Button></div>
        )}
      </div>
      {mode === "refund" && (
        <div className="mt-3 grid gap-2 rounded-xl border border-border-soft bg-white p-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Amount (max {naira(f.credit)})</span><input type="number" min="1" max={f.credit} value={amount} onChange={(e) => setAmount(e.target.value)} className="min-h-9 rounded-[9px] border border-border-soft bg-paper/60 px-2.5 text-[12px] outline-none focus:border-brand-blue" /></label>
          <label className="grid gap-1"><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Reason</span><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. duplicate transfer" className="min-h-9 rounded-[9px] border border-border-soft bg-paper/60 px-2.5 text-[12px] outline-none focus:border-brand-blue" /></label>
          <div className="flex gap-2"><Button size="sm" onClick={submitRefund} disabled={busy}>Submit</Button><Button variant="secondary" size="sm" onClick={() => setMode("none")}>Cancel</Button></div>
        </div>
      )}
      {f.refunds.length > 0 && (
        <div className="mt-3 grid gap-2">
          {f.refunds.map((r) => { const idx = stepIndex(r.status); const rejected = r.status === "rejected"; return (
            <div key={r.id} className="rounded-xl border border-border-soft bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2 text-[12px]"><span className="font-extrabold text-ink">Refund {naira(r.amount)}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${r.status === "approved" ? "bg-brand-green/10 text-brand-green" : rejected ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"}`}>{rejected ? "Rejected" : r.status === "approved" ? "Approved" : "Awaiting approval"}</span></div>
              {!rejected && <div className="flex items-center gap-1">{STEPS.map((st, i) => <div key={st} className="flex flex-1 items-center gap-1"><span className={`grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-extrabold ${i <= idx ? "bg-brand-blue text-white" : "bg-paper text-ink-soft"}`}>{i + 1}</span><span className="hidden text-[9px] font-bold text-ink-soft sm:inline">{st}</span>{i < STEPS.length - 1 && <span className={`h-0.5 flex-1 ${i < idx ? "bg-brand-blue" : "bg-border-soft"}`} />}</div>)}</div>}
              {r.reason && <p className="mt-1.5 text-[11px] text-ink-soft">Reason: {r.reason}</p>}
              {r.status === "pending" && data.canApprove && <div className="mt-2 flex gap-2"><button onClick={() => decide(r.id, true)} disabled={busy} className="rounded-md bg-brand-green/10 px-2.5 py-1 text-[11px] font-extrabold text-brand-green hover:bg-brand-green/20 disabled:opacity-60">Approve refund</button><button onClick={() => decide(r.id, false)} disabled={busy} className="rounded-md bg-danger-soft px-2.5 py-1 text-[11px] font-extrabold text-danger hover:bg-danger-soft disabled:opacity-60">Reject</button></div>}
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}

/* ---------- Finance tab (the finance record) ---------- */
function FinanceTab({ data, onChanged, onErr }: { data: StudentProfile; onChanged: () => void; onErr: (e: string) => void }) {
  const f = data.financial;
  const paidPct = f.invoiced ? Math.round((f.paid / f.invoiced) * 100) : 0;
  const latestReceipt = f.payments.find((p) => p.status === "approved" && p.receiptKey);
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <div className="grid content-start gap-4">
        <CreditPanel data={data} onChanged={onChanged} onErr={onErr} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="Total billed" v={naira(f.invoiced)} c="#2159e8" /><Mini label="Paid so far" v={naira(f.paid)} c="#178a4c" /><Mini label="Outstanding" v={naira(f.outstanding)} c="#b9540f" /><Mini label="Next due" v={f.nextDue ?? "-"} c="#6b2fb3" />
        </div>
        {f.outstanding > 0 && <div className="rounded-xl border border-warn-line bg-warn-soft px-3.5 py-2.5 text-[12px] font-bold text-warn">{paidPct}% paid · {naira(f.outstanding)} mandatory remaining. Ensure balances are cleared before exam clearance or promotion.</div>}
        {f.optionalDue > 0 && <div className="rounded-xl border border-border-soft bg-paper/50 px-3.5 py-2.5 text-[12px] font-bold text-ink-soft">Plus <span className="text-warn">{naira(f.optionalDue)}</span> in optional fees - not required for clearance.</div>}
        <Card title="📒 Student finance ledger">
          {f.ledger.length === 0 ? <p className="text-[12px] text-ink-soft">No financial activity yet.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-[12px]">
              <thead><tr className="border-b border-border-soft text-[9px] uppercase tracking-wide text-ink-soft"><th className="py-1.5 font-bold">Date</th><th className="py-1.5 font-bold">Description</th><th className="py-1.5 text-right font-bold">Amount</th><th className="py-1.5 text-right font-bold">Balance</th><th className="py-1.5 font-bold">Ref</th></tr></thead>
              <tbody>{f.ledger.map((e, i) => <tr key={i} className="border-b border-border-soft last:border-0"><td className="py-2 text-ink-soft">{e.date}</td><td className="py-2 font-bold text-ink">{e.description}{e.method ? <span className="ml-1 font-normal capitalize text-ink-soft">· {e.method}</span> : ""}</td><td className={`py-2 text-right font-extrabold ${e.amount < 0 ? "text-brand-green" : "text-ink"}`}>{e.amount < 0 ? "+" : ""}{naira(Math.abs(e.amount))}</td><td className="py-2 text-right text-ink-soft">{naira(e.balance)}</td><td className="py-2 text-[10px] text-ink-soft">{e.receiptNo ?? "-"}</td></tr>)}</tbody>
            </table></div>
          )}
          <div className="mt-3 flex flex-wrap justify-between gap-2 rounded-xl bg-paper/60 px-3 py-2 text-[11px]"><span className="font-bold text-ink-soft">Total invoiced <strong className="text-ink">{naira(f.invoiced)}</strong></span><span className="font-bold text-ink-soft">Total paid <strong className="text-brand-green">{naira(f.paid)}</strong></span><span className="font-bold text-ink-soft">Outstanding <strong className="text-warn">{naira(f.outstanding)}</strong></span></div>
        </Card>
      </div>
      <div className="grid content-start gap-4">
        <Card title="📄 Invoice breakdown">
          {f.invoiceItems.length === 0 ? <p className="text-[12px] text-ink-soft">No fees issued to this student yet.</p> : (
            <>
              <ul className="grid gap-0">{f.invoiceItems.map((it, i) => <li key={i} className="flex items-center justify-between gap-3 border-b border-border-soft py-2 last:border-0"><span className="min-w-0"><span className="flex items-center gap-1.5"><span className="truncate text-[12px] font-bold text-ink">{it.description}</span>{!it.mandatory && <span className="shrink-0 rounded-full bg-warn-soft px-1.5 py-0.5 text-[9px] font-extrabold text-warn">Optional</span>}</span><span className={`text-[10px] font-extrabold ${it.status === "paid" ? "text-brand-green" : it.status === "partially_paid" ? "text-warn" : "text-danger"}`}>{it.status === "paid" ? "Paid" : it.status === "partially_paid" ? "Part paid" : "Unpaid"}</span></span><span className="shrink-0 text-[12px] font-extrabold text-ink">{naira(it.amount)}</span></li>)}</ul>
              <div className="mt-2 flex items-center justify-between border-t-2 border-border-soft pt-2 text-[13px] font-extrabold"><span>Total</span><span className="text-brand-blue">{naira(f.invoiced)}</span></div>
            </>
          )}
        </Card>
        <Card title="🧾 Receipts">
          {!latestReceipt ? <p className="text-[12px] text-ink-soft">No receipts yet. Approve a payment to generate one.</p> : (
            <div className="grid gap-2">
              <a href={`/r/${latestReceipt.receiptKey}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-brand-blue px-4 py-2.5 text-[12px] font-extrabold text-white transition hover:bg-brand-dark">Open latest receipt ({latestReceipt.receiptNo})</a>
              <p className="text-center text-[11px] text-ink-soft">{f.outstanding > 0 ? "Receipts show the outstanding balance on part-payments." : "All fees cleared."}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
