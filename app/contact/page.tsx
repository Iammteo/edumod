import type { Metadata } from "next";
import Link from "next/link";
import { Logo, navLinks } from "@/components/marketing/brand";
import { ContactForm } from "@/components/marketing/interactive";

export const metadata: Metadata = {
  title: "Contact us | Edumod",
  description: "Talk to the Edumod team about bringing modern school management to your school.",
};

const channels = [
  { icon: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>, label: "Email us", value: "hello@edumod.africa" },
  { icon: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></>, label: "Call us", value: "+234 800 EDUMOD" },
  { icon: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>, label: "Visit us", value: "Lagos, Nigeria" },
];

export default function ContactPage() {
  return (
    <>
      <header className="mx-auto flex h-[78px] w-[min(1180px,calc(100%-48px))] items-center justify-between gap-7 border-b border-border-soft">
        <Link href="/" aria-label="Edumod home"><Logo /></Link>
        <nav className="hidden items-center gap-7 text-[13px] font-bold text-ink-soft lg:flex">{navLinks.map(([label, href]) => <Link className="transition hover:text-brand-blue" href={href} key={href}>{label}</Link>)}</nav>
        <Link href="/" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-[#b9c9ee] bg-white px-[18px] text-[13px] font-extrabold text-brand-dark transition hover:-translate-y-0.5 hover:border-brand-blue"><span aria-hidden>←</span> Home</Link>
      </header>

      <main className="mx-auto grid w-[min(1180px,calc(100%-48px))] items-start gap-12 py-12 sm:py-[72px] lg:grid-cols-[.85fr_1.15fr] lg:gap-[64px]">
        <div>
          <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-brand-blue">Contact us</span>
          <h1 className="mt-4 font-display text-[clamp(34px,4.5vw,52px)] font-extrabold leading-[1.05] tracking-[-.04em]">Let&rsquo;s bring clarity to your school</h1>
          <p className="mt-5 max-w-[460px] text-[15px] leading-[1.8] text-ink-soft">Whether you want a guided demo or just have a question, our team is here to help you get started with Edumod.</p>
          <div className="mt-8 grid gap-3">
            {channels.map((c) => (
              <div key={c.label} className="flex items-center gap-3.5 rounded-2xl border border-border-soft bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(16,33,63,.08)]">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-5">{c.icon}</svg></span>
                <div><div className="text-[11px] font-extrabold uppercase tracking-[.06em] text-ink-soft">{c.label}</div><div className="text-[15px] font-extrabold text-ink">{c.value}</div></div>
              </div>
            ))}
          </div>
        </div>
        <ContactForm />
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
