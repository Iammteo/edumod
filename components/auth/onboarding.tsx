"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/marketing/brand";
import { getInvite, acceptInvite, uploadStaffPhoto, type Invite } from "@/lib/actions/onboarding";

const STEPS = ["Accept invitation", "Set password", "Personal information", "Upload photo", "Ready"];
const inputCls = "min-h-11 w-full rounded-[12px] border border-border-soft bg-white px-3.5 text-[14px] text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20";
const ROLE_LABEL: Record<string, string> = { principal: "Principal", vice_principal: "Vice principal", teacher: "Teacher", bursar: "Bursar" };
const pwScore = (p: string) => [p.length >= 8, /[A-Z]/.test(p), /[0-9]/.test(p), /[^a-zA-Z0-9]/.test(p)].filter(Boolean).length;

export function Onboarding({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null | "loading">("loading");
  const [step, setStep] = useState(1);
  const [pw, setPw] = useState(""); const [confirm, setConfirm] = useState(""); const [show, setShow] = useState(false);
  const [p, setP] = useState({ phone: "", address: "", dob: "", emergencyName: "", emergencyRelationship: "", emergencyPhone: "" });
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getInvite(token).then((r) => setInvite(r)); }, [token]);

  if (invite === "loading") return <Shell><div className="grid place-items-center py-20 text-[13px] text-ink-soft">Loading your invitation…</div></Shell>;
  if (!invite) return <Shell><div className="grid place-items-center py-16 text-center"><div className="mb-3 grid size-14 place-items-center rounded-full bg-danger-soft text-2xl text-danger">!</div><h1 className="font-display text-2xl font-semibold">Invitation not found</h1><p className="mt-2 max-w-sm text-[13px] text-ink-soft">This invitation link is invalid or has already been used. Please ask your school admin to re-send it.</p></div></Shell>;

  async function complete() {
    setBusy(true); setError(null);
    const r = await acceptInvite(token, pw, p);
    setBusy(false);
    if ("error" in r) { setError(r.error); return; }
    setStep(4);
  }
  async function upload(file: File) {
    setBusy(true); setError(null);
    const fd = new FormData(); fd.append("photo", file);
    const r = await uploadStaffPhoto(fd);
    setBusy(false);
    if ("error" in r) { setError(r.error); return; }
    setPhoto(`${r.url}?t=${Date.now()}`);
  }

  const score = pwScore(pw);
  const first = invite.name.split(" ")[0];

  return (
    <Shell>
      <div className="mb-2 flex items-center justify-between">
        <div><h1 className="font-display text-[clamp(24px,4vw,34px)] font-extrabold tracking-[-.03em]">Welcome to Edumod, {first}! 🎉</h1><p className="mt-1 text-[14px] text-ink-soft">Let&rsquo;s set up your account so you can start making an impact.</p></div>
      </div>

      {/* Stepper */}
      <div className="my-7 flex items-center gap-1">{STEPS.map((s, i) => { const n = i + 1; return <div key={s} className="flex flex-1 items-center gap-1 last:flex-none"><div className="flex items-center gap-2"><span className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold transition ${n < step ? "bg-brand-green text-white" : n === step ? "bg-brand-blue text-white" : "border border-border-soft bg-white text-ink-soft"}`}>{n < step ? "✓" : n}</span><span className={`hidden text-[11px] font-bold sm:block ${n === step ? "text-brand-blue" : "text-ink-soft"}`}>{s}</span></div>{n < STEPS.length && <span className={`h-px flex-1 ${n < step ? "bg-brand-green" : "bg-border-soft"}`} />}</div>; })}</div>

      <div className="rounded-2xl border border-border-soft bg-white p-6 sm:p-8 motion-safe:animate-[fade-up_.4s_ease]">
        {error && <div className="mb-4 rounded-[12px] border border-danger-line bg-danger-soft px-3.5 py-2.5 text-[12px] font-bold text-danger">{error}</div>}

        {step === 1 && <div className="grid gap-5 sm:grid-cols-[1fr_300px]">
          <div>
            <h2 className="font-display text-[20px] font-semibold">You&rsquo;re invited to {invite.schoolName}</h2>
            <p className="mt-1 text-[14px] text-ink-soft">You&rsquo;ve been invited as a <strong className="text-ink">{invite.employmentType ? `${invite.employmentType} ` : ""}{ROLE_LABEL[invite.role] ?? invite.role}</strong>.</p>
            <div className="mt-5 grid gap-3 text-[13px]">
              {invite.subjects.length > 0 && <div><span className="text-[11px] font-extrabold text-ink-soft">Assigned subjects</span><div className="mt-1 flex flex-wrap gap-1.5">{invite.subjects.map((s) => <span key={s} className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand-blue">{s}</span>)}</div></div>}
              {(invite.isClassTeacher || invite.teachingClasses.length > 0) && <div><span className="text-[11px] font-extrabold text-ink-soft">Classes</span><div className="mt-1 flex flex-wrap gap-1.5">{Array.from(new Set((invite.isClassTeacher && invite.assignedClass ? [invite.assignedClass, ...invite.teachingClasses] : invite.teachingClasses).filter(Boolean))).map((c) => <span key={c} className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-bold text-ink-soft">{c}</span>)}</div></div>}
              {invite.isClassTeacher && <div className="text-[12px]"><span className="font-extrabold text-ink-soft">Class teacher:</span> <span className="font-bold text-brand-green">Yes{invite.assignedClass ? ` · ${invite.assignedClass}` : ""}</span></div>}
            </div>
          </div>
          <div className="grid content-start gap-3">
            <div className="rounded-xl bg-brand-soft/50 p-3.5"><p className="text-[12px] font-extrabold text-ink">🔒 Secure &amp; private</p><p className="mt-1 text-[11px] leading-relaxed text-ink-soft">Your information is encrypted and kept safe. You control your data.</p></div>
            <button onClick={() => setStep(2)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-brand-blue px-5 text-[14px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark">Get started →</button>
          </div>
        </div>}

        {step === 2 && <div className="mx-auto grid max-w-[440px] gap-4">
          <h2 className="font-display text-[20px] font-semibold">Set your password</h2>
          <label className="grid gap-1.5"><span className="text-[12px] font-extrabold text-ink">Password</span><div className="relative"><input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" className={`${inputCls} pr-16`} /><button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-brand-blue">{show ? "Hide" : "Show"}</button></div>
            <div className="mt-1 flex gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < score ? (score <= 1 ? "bg-[#e0574f]" : score === 2 ? "bg-[#e0a23f]" : "bg-brand-green") : "bg-border-soft"}`} />)}</div>
            <span className="text-[10px] text-ink-soft">{score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong"} password</span>
          </label>
          <label className="grid gap-1.5"><span className="text-[12px] font-extrabold text-ink">Confirm password</span><input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" className={inputCls} /></label>
          <div className="flex justify-between"><button onClick={() => setStep(1)} className="rounded-[10px] border border-border-soft px-4 py-2 text-[13px] font-extrabold text-ink-soft">← Back</button><button disabled={pw.length < 8 || pw !== confirm} onClick={() => setStep(3)} className="rounded-[10px] bg-brand-blue px-5 py-2 text-[13px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-50">Continue →</button></div>
        </div>}

        {step === 3 && <div className="grid gap-4">
          <h2 className="font-display text-[20px] font-semibold">Personal information</h2>
          <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5"><span className="text-[12px] font-extrabold text-ink">Phone number</span><input className={inputCls} value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} placeholder="+234 803 456 7890" /></label><label className="grid gap-1.5"><span className="text-[12px] font-extrabold text-ink">Date of birth</span><input type="date" className={inputCls} value={p.dob} onChange={(e) => setP({ ...p, dob: e.target.value })} /></label></div>
          <label className="grid gap-1.5"><span className="text-[12px] font-extrabold text-ink">Residential address</span><input className={inputCls} value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} placeholder="12 Admiralty Way, Lekki, Lagos" /></label>
          <div><span className="text-[12px] font-extrabold text-ink">Emergency contact</span><div className="mt-1.5 grid gap-4 sm:grid-cols-3"><input className={inputCls} value={p.emergencyName} onChange={(e) => setP({ ...p, emergencyName: e.target.value })} placeholder="Contact name" /><input className={inputCls} value={p.emergencyRelationship} onChange={(e) => setP({ ...p, emergencyRelationship: e.target.value })} placeholder="Relationship" /><input className={inputCls} value={p.emergencyPhone} onChange={(e) => setP({ ...p, emergencyPhone: e.target.value })} placeholder="Phone" /></div></div>
          <div className="flex justify-between"><button onClick={() => setStep(2)} className="rounded-[10px] border border-border-soft px-4 py-2 text-[13px] font-extrabold text-ink-soft">← Back</button><button disabled={busy} onClick={complete} className="rounded-[10px] bg-brand-blue px-5 py-2 text-[13px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-60">{busy ? "Saving…" : "Continue →"}</button></div>
        </div>}

        {step === 4 && <div className="mx-auto grid max-w-[420px] place-items-center gap-4 text-center">
          <h2 className="font-display text-[20px] font-semibold">Upload your photo</h2>
          <p className="-mt-2 text-[13px] text-ink-soft">Add a clear photo to help colleagues recognise you.</p>
          <div className="grid size-28 place-items-center overflow-hidden rounded-full border border-border-soft bg-paper">{photo ? <img src={photo} alt="" className="size-full object-cover" /> : <span className="text-3xl text-ink-soft">📷</span>}</div>
          <label className="cursor-pointer text-[13px] font-extrabold text-brand-blue hover:underline">Choose a photo<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} /></label>
          {busy && <span className="text-[11px] text-ink-soft">Uploading…</span>}
          <div className="mt-2 flex gap-2.5"><button onClick={() => setStep(5)} className="rounded-[10px] border border-border-soft px-5 py-2 text-[13px] font-extrabold text-ink-soft">Skip for now</button><button onClick={() => setStep(5)} className="rounded-[10px] bg-brand-blue px-5 py-2 text-[13px] font-extrabold text-white transition hover:bg-brand-dark">Continue →</button></div>
        </div>}

        {step === 5 && <div className="mx-auto grid max-w-[440px] place-items-center gap-3 py-4 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-brand-green/10 text-3xl text-brand-green">✓</div>
          <h2 className="font-display text-[24px] font-semibold">You&rsquo;re all set! 🎉</h2>
          <p className="max-w-sm text-[13px] leading-relaxed text-ink-soft">Your account is ready. You can now access your assigned classes, subjects and the tools available to you.</p>
          <ul className="mt-1 grid gap-1.5 text-left text-[12px]">
            {invite.subjects.length > 0 && <li className="flex gap-2 text-ink-soft"><span className="text-brand-green">✓</span>Subjects: {invite.subjects.join(", ")}</li>}
            {invite.teachingClasses.length > 0 && <li className="flex gap-2 text-ink-soft"><span className="text-brand-green">✓</span>Classes: {invite.teachingClasses.join(", ")}</li>}
            <li className="flex gap-2 text-ink-soft"><span className="text-brand-green">✓</span>Role: {ROLE_LABEL[invite.role] ?? invite.role}</li>
          </ul>
          <button onClick={() => router.push("/dashboard")} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[12px] bg-brand-blue px-6 text-[14px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark">Go to my workspace →</button>
        </div>}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto flex h-[72px] w-[min(1000px,calc(100%-40px))] items-center justify-between"><Logo /><a href="/contact" className="rounded-[10px] border border-border-soft bg-white px-3.5 py-2 text-[12px] font-bold text-ink-soft transition hover:border-brand-blue hover:text-brand-blue">? Need help?</a></header>
      <main className="mx-auto w-[min(1000px,calc(100%-40px))] pb-16">{children}</main>
    </div>
  );
}
