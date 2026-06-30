"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/client";
import { Avatar, SupportMenu } from "./sidebar-bits";

function Diamond({ small }: { small?: boolean }) {
  return <span className={`grid rotate-45 place-items-center border-2 border-brand-green ${small ? "size-5" : "size-6"}`}><i className={`border-2 border-brand-green ${small ? "size-[6px]" : "size-[7px]"}`} /></span>;
}

export function DashboardChrome({ roleLabel, school, schoolCode, term, userName, title, subtitle, nav, active, onSelect, headerAction, children }: { roleLabel: string; school: string; schoolCode: string; term: string; userName: string; title: string; subtitle: string; nav: string[]; active?: string; onSelect?: (name: string) => void; headerAction?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  async function logout() { await signOut(); router.push("/login"); }

  const side = (
    <>
      <div className="inline-flex items-center gap-2.5 font-display text-[22px] font-semibold text-white"><Diamond />Edumod</div>
      <div className="my-[22px] rounded-[10px] border border-white/15 p-3 text-[11px] text-[#eef4ff]"><strong>{school}</strong><br />{term}<div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2"><span className="text-sidebar-muted">School code</span><code className="select-all font-extrabold tracking-wide text-white">{schoolCode}</code></div></div>
      <nav className="grid min-h-0 flex-1 content-start overflow-y-auto">{nav.map((name, i) => {
        const isActive = onSelect ? name === active : i === 0;
        const cls = `my-0.5 rounded-[9px] px-3 py-2.5 text-left text-[13px] font-bold transition ${isActive ? "bg-sidebar-active text-white" : "text-sidebar-faint hover:bg-white/10"}`;
        return onSelect
          ? <button key={name} onClick={() => { onSelect(name); setOpen(false); }} className={cls}>{name}</button>
          : <a key={name} href={`#${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} onClick={() => setOpen(false)} className={cls}>{name}</a>;
      })}</nav>
      <div className="mt-auto border-t border-white/15 pt-3.5">
        <div className="flex items-center gap-2.5"><Avatar name={userName} size={34} /><div className="min-w-0 flex-1 text-[11px] text-white"><div className="truncate font-bold">{userName}</div><div className="text-sidebar-muted">{roleLabel}</div></div></div>
        <SupportMenu />
        <button onClick={logout} className="mt-1 flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[12px] font-bold text-sidebar-faint transition hover:bg-white/10 hover:text-white"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg><span className="flex-1 text-left">Sign out</span></button>
      </div>
    </>
  );

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[248px_1fr]">
      <aside className="hidden flex-col bg-ink px-4 py-[20px] lg:flex lg:sticky lg:top-0 lg:h-screen">{side}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-[min(260px,85vw)] flex-col overflow-y-auto bg-ink px-4 py-[23px] motion-safe:animate-[fade-up_.2s_ease]">{side}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border-soft bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid size-10 place-items-center rounded-[10px] border border-border-soft"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-5"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg></button>
          <span className="inline-flex items-center gap-2 font-display text-[18px] font-semibold"><Diamond small />Edumod</span>
          <button onClick={logout} className="rounded-[9px] border border-border-soft px-3 py-1.5 text-[12px] font-extrabold text-ink-soft transition hover:text-brand-blue">Sign out</button>
        </header>
        <main className="overflow-x-hidden p-4 sm:p-7 lg:px-[34px] lg:py-[28px]">
          <div id="overview" className="flex scroll-mt-6 flex-col justify-between gap-4 sm:flex-row sm:items-center">
            {(title || subtitle) && <div><h1 className="font-display text-[clamp(24px,4vw,31px)] font-semibold leading-[1.1]">{title}</h1>{subtitle && <p className="mt-1 text-[13px] text-ink-soft">{subtitle}</p>}</div>}
            <div className="flex items-center gap-3">
              {headerAction}
              <div className="rounded-[10px] border border-border-soft bg-white px-[13px] py-2.5 text-[11px]">Current term<br /><strong>{term}</strong></div>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
