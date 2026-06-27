import Link from "next/link";
import { Logo, navLinks } from "./brand";

export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: { heading: string; body: string }[] }) {
  return (
    <>
      <header className="mx-auto flex h-[78px] w-[min(1180px,calc(100%-48px))] items-center justify-between gap-7 border-b border-border-soft">
        <Link href="/" aria-label="Edumod home"><Logo /></Link>
        <nav className="hidden items-center gap-7 text-[13px] font-bold text-ink-soft lg:flex">{navLinks.map(([label, href]) => <Link className="transition hover:text-brand-blue" href={href} key={href}>{label}</Link>)}</nav>
        <Link href="/" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-[#b9c9ee] bg-white px-[18px] text-[13px] font-extrabold text-brand-dark transition hover:-translate-y-0.5 hover:border-brand-blue"><span aria-hidden>←</span> Home</Link>
      </header>

      <main className="mx-auto w-[min(760px,calc(100%-48px))] py-12 sm:py-[64px]">
        <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-brand-blue">Legal</span>
        <h1 className="mt-4 font-display text-[clamp(30px,4.5vw,46px)] font-extrabold leading-[1.06] tracking-[-.04em]">{title}</h1>
        <p className="mt-3 text-[13px] text-ink-soft">Last updated {updated}</p>
        <div className="mt-8 grid gap-7">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-[18px] font-semibold">{s.heading}</h2>
              <p className="mt-2 text-[14px] leading-[1.85] text-ink-soft">{s.body}</p>
            </section>
          ))}
        </div>
        <p className="mt-10 rounded-2xl border border-border-soft bg-brand-soft/40 p-4 text-[13px] leading-[1.7] text-ink-soft">Questions about this page? <Link href="/contact" className="font-extrabold text-brand-blue hover:underline">Contact our team</Link> and we&rsquo;ll be glad to help.</p>
      </main>

      <footer className="mt-12 border-t border-border-soft py-8">
        <div className="mx-auto flex w-[min(1180px,calc(100%-48px))] flex-col items-center justify-between gap-4 text-[12px] text-ink-soft sm:flex-row">
          <Logo />
          <span>© {new Date().getFullYear()} Edumod by Klavoir Technology</span>
        </div>
      </footer>
    </>
  );
}
