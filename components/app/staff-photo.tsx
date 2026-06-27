"use client";

import { useRef, useState } from "react";
import { uploadStaffPhoto } from "@/lib/actions/onboarding";

export function StaffPhotoCard({ name, image }: { name: string; image: string | null }) {
  const [img, setImg] = useState(image);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  async function upload(file: File) {
    setBusy(true); setMsg(null);
    const fd = new FormData(); fd.append("photo", file);
    const r = await uploadStaffPhoto(fd);
    setBusy(false);
    if ("error" in r) { setMsg(r.error); return; }
    setImg(`${r.url}?t=${Date.now()}`);
  }
  return (
    <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left">
      <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-border-soft bg-paper">{img ? <img src={img} alt="Your photo" className="size-full object-cover" /> : <span className="font-display text-2xl font-bold text-brand-blue">{initials}</span>}</div>
      <div>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        <button onClick={() => ref.current?.click()} disabled={busy} className="inline-flex min-h-9 items-center rounded-[10px] bg-brand-blue px-3.5 text-[12px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark disabled:opacity-70">{busy ? "Uploading…" : img ? "Change photo" : "Upload photo"}</button>
        {msg && <p className="mt-1.5 text-[11px] font-bold text-[#b3261e]">{msg}</p>}
        <p className="mt-1.5 text-[10px] text-ink-soft">JPG or PNG, under 5MB.</p>
      </div>
    </div>
  );
}
