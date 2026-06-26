"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/client";

function Diamond({ small }: { small?: boolean }) {
  return <span className={`grid rotate-45 place-items-center border-2 border-brand-green ${small ? "size-5" : "size-6"}`}><i className={`border-2 border-brand-green ${small ? "size-[6px]" : "size-[7px]"}`} /></span>;
}

export function DashboardChrome({ roleLabel, school, schoolCode, term, userName, title, subtitle, nav, children }: { roleLabel: string; school: string; schoolCode: string; term: string; userName: string; title: string; subtitle: string; nav: string[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  async function logout() { await signOut(); router.push("/login"); }

  const side = (
    <>
      <div className="inline-flex items-center gap-2.5 font-display text-[22px] font-semibold text-white"><Diamond />Edumod</div>
      <div className="my-[22px] rounded-[10px] border border-white/15 p-3 text-[11px] text-[#eef4ff]"><strong>{school}</strong><br />{term}<div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2"><span className="text-[#9fb6d8]">School code</span><code className="select-all font-extrabold tracking-wide text-white">{schoolCode}</code></div></div>
      <nav className="grid">{nav.map((name, i) => <a key={name} href="#" className={`my-0.5 rounded-[9px] px-3 py-2.5 text-[13px] font-bold transition ${i === 0 ? "bg-[#174e97] text-white" : "text-[#ced9eb] hover:bg-white/10"}`}>{name}</a>)}</nav>
      <div className="mt-auto border-t border-white/15 pt-[15px]">
        <div className="text-[11px] text-[#d8e3f3]">{userName}<br /><span className="text-[#9fb6d8]">{roleLabel}</span></div>
        <button onClick={logout} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[9px] border border-white/20 px-3 py-2 text-[12px] font-extrabold text-white transition hover:bg-white/10">Sign out</button>
      </div>
    </>
  );

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[248px_1fr]">
      <aside className="hidden flex-col bg-ink px-4 py-[23px] lg:flex">{side}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-[260px] flex-col bg-ink px-4 py-[23px] motion-safe:animate-[fade-up_.2s_ease]">{side}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border-soft bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid size-10 place-items-center rounded-[10px] border border-border-soft"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-5"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg></button>
          <span className="inline-flex items-center gap-2 font-display text-[18px] font-semibold"><Diamond small />Edumod</span>
          <button onClick={logout} className="rounded-[9px] border border-border-soft px-3 py-1.5 text-[12px] font-extrabold text-ink-soft transition hover:text-brand-blue">Sign out</button>
        </header>
        <main className="p-4 sm:p-7 lg:px-[34px] lg:py-[28px]">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div><h1 className="font-display text-[clamp(24px,4vw,31px)] font-semibold leading-[1.1]">{title}</h1><p className="mt-1 text-[13px] text-ink-soft">{subtitle}</p></div>
            <div className="rounded-[10px] border border-border-soft bg-white px-[13px] py-2.5 text-[11px]">Current term<br /><strong>{term}</strong></div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
