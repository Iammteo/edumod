"use client";

import { useState } from "react";
import { updateStudentProfile, type StudentProfile, type StudentBio, type Guardian } from "@/lib/actions/students";
import { useClassNames } from "@/components/app/use-classes";

const GENOTYPES = ["AA", "AS", "SS", "AC", "SC"];
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const inputCls = "min-h-9 w-full rounded-[9px] border border-border-soft bg-paper/60 px-2.5 text-[12px] text-ink outline-none transition focus:border-brand-blue focus:bg-white";

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) { return <label className={`grid gap-1 ${full ? "sm:col-span-2" : ""}`}><span className="text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">{label}</span>{children}</label>; }
function Box({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-2xl border border-border-soft bg-white p-4"><h3 className="mb-3 font-display text-[14px] font-semibold">{title}</h3>{children}</div>; }

export function StudentProfileEdit({ data, onClose, onSaved }: { data: StudentProfile; onClose: () => void; onSaved: () => void }) {
  const [bio, setBio] = useState<StudentBio>(data.bio);
  const [className, setClassName] = useState(data.className ?? "");
  const classNames = useClassNames();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof StudentBio, v: string) => setBio((p) => ({ ...p, [k]: v }));
  const setG = (which: "guardian1" | "guardian2", k: keyof Guardian, v: string) => setBio((p) => ({ ...p, [which]: { ...p[which], [k]: v } }));
  const setEm = (k: keyof StudentBio["emergency"], v: string) => setBio((p) => ({ ...p, emergency: { ...p.emergency, [k]: v } }));

  async function save() {
    setBusy(true); setErr(null);
    const r = await updateStudentProfile(data.id, { className, bio });
    setBusy(false);
    if ("error" in r) { setErr(r.error); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-3 sm:p-6" onClick={onClose}>
      <div className="mx-auto w-[min(820px,100%)] rounded-2xl bg-paper shadow-[0_30px_80px_rgba(16,33,63,.3)] motion-safe:animate-[fade-up_.2s_ease]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border-soft bg-white px-5 py-3.5"><h2 className="font-display text-[17px] font-semibold">Edit — {data.name}</h2><button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-paper">✕</button></div>
        <div className="grid gap-4 p-5">
          {err && <div className="rounded-[10px] border border-[#f3c2c2] bg-[#fdeeee] px-3 py-2 text-[12px] font-bold text-[#b3261e]">{err}</div>}
          <Box title="Bio data">
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Sex"><select value={bio.sex} onChange={(e) => set("sex", e.target.value)} className={inputCls}><option value="">—</option><option>Male</option><option>Female</option></select></F>
              <F label="Date of birth"><input type="date" value={bio.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} className={inputCls} /></F>
              <F label="Class"><select value={className} onChange={(e) => setClassName(e.target.value)} className={inputCls}><option value="">No class</option>{classNames.map((c) => <option key={c}>{c}</option>)}</select></F>
              <F label="Arm / Section"><input value={bio.arm} onChange={(e) => set("arm", e.target.value)} className={inputCls} placeholder="A / Gold / Diligence" /></F>
              <F label="House"><input value={bio.house} onChange={(e) => set("house", e.target.value)} className={inputCls} placeholder="Emerald / Green" /></F>
              <F label="Religion"><input value={bio.religion} onChange={(e) => set("religion", e.target.value)} className={inputCls} placeholder="Christianity / Islam" /></F>
              <F label="Genotype"><select value={bio.genotype} onChange={(e) => set("genotype", e.target.value)} className={inputCls}><option value="">—</option>{GENOTYPES.map((g) => <option key={g}>{g}</option>)}</select></F>
              <F label="Blood group"><select value={bio.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)} className={inputCls}><option value="">—</option>{BLOOD.map((g) => <option key={g}>{g}</option>)}</select></F>
              <F label="Nationality"><input value={bio.nationality} onChange={(e) => set("nationality", e.target.value)} className={inputCls} placeholder="Nigerian" /></F>
              <F label="State of origin"><input value={bio.stateOfOrigin} onChange={(e) => set("stateOfOrigin", e.target.value)} className={inputCls} placeholder="Imo State" /></F>
              <F label="L.G.A."><input value={bio.lga} onChange={(e) => set("lga", e.target.value)} className={inputCls} placeholder="Owerri North" /></F>
              <F label="Home address" full><input value={bio.address} onChange={(e) => set("address", e.target.value)} className={inputCls} /></F>
            </div>
          </Box>
          <Box title="Medical & welfare">
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Medical conditions (e.g. asthmatic)" full><textarea value={bio.medicalNotes} onChange={(e) => set("medicalNotes", e.target.value)} rows={2} className={`${inputCls} resize-y py-2`} placeholder="e.g. Asthmatic — keep inhaler nearby." /></F>
              <F label="Allergies"><input value={bio.allergies} onChange={(e) => set("allergies", e.target.value)} className={inputCls} placeholder="Dust, Pollen, Nuts" /></F>
              <F label="Dietary notes"><input value={bio.dietaryNotes} onChange={(e) => set("dietaryNotes", e.target.value)} className={inputCls} placeholder="No nuts / No peanuts" /></F>
              <F label="Special support" full><input value={bio.specialSupport} onChange={(e) => set("specialSupport", e.target.value)} className={inputCls} placeholder="Needs extra time during exams" /></F>
            </div>
          </Box>
          {([["guardian1", "Guardian / Parent 1"], ["guardian2", "Guardian / Parent 2"]] as const).map(([key, title]) => (
            <Box key={key} title={title}>
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Name"><input value={bio[key].name} onChange={(e) => setG(key, "name", e.target.value)} className={inputCls} /></F>
                <F label="Relationship"><input value={bio[key].relationship} onChange={(e) => setG(key, "relationship", e.target.value)} className={inputCls} placeholder="Father / Mother" /></F>
                <F label="Phone"><input value={bio[key].phone} onChange={(e) => setG(key, "phone", e.target.value)} className={inputCls} placeholder="+234…" /></F>
                <F label="Email"><input value={bio[key].email} onChange={(e) => setG(key, "email", e.target.value)} className={inputCls} /></F>
                <F label="Occupation"><input value={bio[key].occupation} onChange={(e) => setG(key, "occupation", e.target.value)} className={inputCls} /></F>
                <F label="Address"><input value={bio[key].address} onChange={(e) => setG(key, "address", e.target.value)} className={inputCls} /></F>
              </div>
            </Box>
          ))}
          <Box title="Emergency contact">
            <div className="grid gap-3 sm:grid-cols-3">
              <F label="Name"><input value={bio.emergency.name} onChange={(e) => setEm("name", e.target.value)} className={inputCls} /></F>
              <F label="Relationship"><input value={bio.emergency.relationship} onChange={(e) => setEm("relationship", e.target.value)} className={inputCls} /></F>
              <F label="Phone"><input value={bio.emergency.phone} onChange={(e) => setEm("phone", e.target.value)} className={inputCls} /></F>
            </div>
          </Box>
          <Box title="Notes & remarks">
            <textarea value={bio.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={`${inputCls} resize-y py-2`} placeholder="General remarks about the student…" />
          </Box>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 rounded-b-2xl border-t border-border-soft bg-white px-5 py-3.5">
          <button onClick={onClose} className="inline-flex min-h-10 items-center rounded-[10px] border border-border-soft bg-white px-4 text-[13px] font-extrabold text-ink-soft hover:border-brand-blue">Cancel</button>
          <button onClick={save} disabled={busy} className="inline-flex min-h-10 items-center rounded-[10px] bg-brand-blue px-5 text-[13px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-70">{busy ? "Saving…" : "Save profile"}</button>
        </div>
      </div>
    </div>
  );
}
