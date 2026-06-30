"use client";

import { useState } from "react";

// Shared sidebar pieces used by both the admin app and the staff/student chrome, so the profile
// footer and Help & support look and behave identically across roles.

const I = (p: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">{p}</svg>;

export function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }
const AV_COLORS = ["#2159e8", "#178a4c", "#b9540f", "#6b2fb3", "#0d8aa8"];
export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  const c = AV_COLORS[name.length % AV_COLORS.length];
  return <span className="grid shrink-0 place-items-center rounded-full font-extrabold text-white" style={{ width: size, height: size, backgroundColor: c, fontSize: size * 0.36 }}>{initials(name)}</span>;
}

const SUPPORT_EMAIL = "support@edumod.app";
const HELP_URL = "https://edumod.app/help";
// Sits at the foot of the sidebar; opens a popover upward with the common support actions.
export function SupportMenu() {
  const [open, setOpen] = useState(false);
  const item = "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-bold transition";
  return (
    <div className="relative mt-2">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[12px] font-bold text-sidebar-faint transition hover:bg-white/10 hover:text-white">
        {I(<><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></>)}
        <span className="flex-1 text-left">Help &amp; support</span>
        <span className={`transition ${open ? "rotate-180" : ""}`}>{I(<path d="m18 15-6-6-6 6" />)}</span>
      </button>
      {open && <><div className="fixed inset-0 z-40" onClick={() => setOpen(false)} /><div className="absolute bottom-12 left-0 z-50 w-56 rounded-xl border border-border-soft bg-white p-1.5 shadow-[0_20px_50px_rgba(16,33,63,.28)] motion-safe:animate-[fade-up_.2s_ease]">
        <p className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-ink-soft">Help &amp; support</p>
        <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Edumod support request")}`} onClick={() => setOpen(false)} className={`${item} text-ink hover:bg-paper`}>{I(<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></>)} Email support</a>
        <a href={HELP_URL} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className={`${item} text-ink hover:bg-paper`}>{I(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>)} Help &amp; guides</a>
        <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Edumod bug report")}`} onClick={() => setOpen(false)} className={`${item} text-danger hover:bg-danger-soft`}>{I(<><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6zM12 20v-9" /></>)} Report a problem</a>
      </div></>}
    </div>
  );
}
