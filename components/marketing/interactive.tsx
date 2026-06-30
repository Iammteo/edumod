"use client";

import { useEffect, useRef, useState } from "react";
import { submitContact } from "@/lib/actions/contact";

/* ---------- Contact form ---------- */
export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSending(true); setError(null);
    const r = await submitContact({ name: String(fd.get("name") || ""), email: String(fd.get("email") || ""), school: String(fd.get("school") || ""), phone: String(fd.get("phone") || ""), message: String(fd.get("message") || "") });
    setSending(false);
    if ("error" in r) { setError(r.error); return; }
    setSent(true);
  }
  if (sent) {
    return (
      <div className="grid place-items-center rounded-[20px] border border-border-soft bg-white p-10 text-center shadow-[0_20px_60px_rgba(16,33,63,.10)] motion-safe:animate-[fade-up_.5s_ease]">
        <div className="mb-4 grid size-14 place-items-center rounded-full bg-brand-soft text-brand-blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-7"><path d="m5 13 4 4L19 7" /></svg>
        </div>
        <h3 className="font-display text-2xl font-semibold">Message sent</h3>
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-ink-soft">Thanks for reaching out. A member of the Edumod team will get back to you shortly.</p>
        <button onClick={() => setSent(false)} className="mt-5 text-[13px] font-extrabold text-brand-blue hover:underline">Send another message</button>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-[20px] border border-border-soft bg-white p-6 shadow-[0_20px_60px_rgba(16,33,63,.10)] sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="name" placeholder="Jane Adeyemi" required />
        <Field label="Work email" name="email" type="email" placeholder="jane@school.edu.ng" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="School name" name="school" placeholder="Brightfield Schools" required />
        <Field label="Phone (optional)" name="phone" type="tel" placeholder="+234 800 000 0000" />
      </div>
      <label className="grid gap-1.5">
        <span className="text-[12px] font-extrabold text-ink">How can we help?</span>
        <textarea name="message" required rows={4} placeholder="Tell us a little about your school and what you'd like to achieve." className="resize-y rounded-[12px] border border-border-soft bg-paper/60 px-3.5 py-2.5 text-[14px] text-ink outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
      </label>
      {error && <p className="-mb-1 text-[12px] font-bold text-danger">{error}</p>}
      <button type="submit" disabled={sending} className="mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-brand-blue px-5 text-[14px] font-extrabold text-white shadow-[0_8px_18px_rgba(33,89,232,.22)] transition hover:-translate-y-0.5 hover:bg-brand-dark disabled:opacity-70">
        {sending ? "Sending…" : <>Send message <span aria-hidden>→</span></>}
      </button>
    </form>
  );
}

function Field({ label, name, type = "text", placeholder, required }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-extrabold text-ink">{label}</span>
      <input name={name} type={type} placeholder={placeholder} required={required} className="min-h-11 rounded-[12px] border border-border-soft bg-paper/60 px-3.5 text-[14px] text-ink outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20" />
    </label>
  );
}

/* ---------- Scroll-reveal wrapper ---------- */
export function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transition-all duration-700 ease-out ${shown ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"} ${className}`}>{children}</div>;
}

/* ---------- Testimonials carousel ---------- */
const TESTIMONIALS = [
  { quote: "Edumod gave us one clear view of attendance and fees across all our branches. What used to take days now takes minutes.", name: "Mrs. Folake Adeyemi", role: "Head Teacher", school: "Brightfield Schools, Lagos", grad: "linear-gradient(135deg,#2159e8,#143a99)" },
  { quote: "The maker-checker approval flow means I finally trust every number I sign off on. Reconciliation is no longer a headache.", name: "Mr. Chinedu Okafor", role: "Bursar", school: "Crestview Academy, Enugu", grad: "linear-gradient(135deg,#178a4c,#0d6b39)" },
  { quote: "Parents now get instant updates, and our teachers spend far more time teaching than filling registers by hand.", name: "Mrs. Aisha Bello", role: "Principal", school: "Northgate International, Abuja", grad: "linear-gradient(135deg,#b9540f,#8a3d0a)" },
  { quote: "Onboarding moved our records across safely, and the permanent audit trail gives our board real confidence.", name: "Dr. Emeka Nwosu", role: "Proprietor", school: "Summit Group of Schools, Port Harcourt", grad: "linear-gradient(135deg,#6b2fb3,#4c2080)" },
];

function initialsOf(name: string) {
  return name.split(" ").filter((w) => !w.endsWith(".")).slice(-2).map((w) => w[0]).join("");
}

export function Testimonials() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = TESTIMONIALS.length;
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), 6000);
    return () => clearInterval(t);
  }, [paused, n]);
  const go = (d: number) => setI((p) => (p + d + n) % n);
  const t = TESTIMONIALS[i];
  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} className="relative mx-auto max-w-[820px] overflow-hidden rounded-[28px] border border-border-soft bg-white p-7 shadow-[0_20px_60px_rgba(16,33,63,.10)] sm:p-12">
      <div aria-hidden className="pointer-events-none absolute -top-12 right-0 select-none font-display text-[170px] leading-none text-brand-soft">&rdquo;</div>
      <div key={i} className="relative motion-safe:animate-[fade-up_.5s_ease]">
        <p className="font-display text-[19px] font-medium leading-[1.5] text-ink sm:text-[26px]">&ldquo;{t.quote}&rdquo;</p>
        <div className="mt-7 flex items-center gap-4">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full text-[15px] font-extrabold text-white" style={{ backgroundImage: t.grad }}>{initialsOf(t.name)}</span>
          <div>
            <div className="text-[15px] font-extrabold text-ink">{t.name}</div>
            <div className="text-[12px] text-ink-soft">{t.role} · {t.school}</div>
          </div>
        </div>
      </div>
      <div className="mt-8 flex items-center justify-between">
        <div className="flex gap-2">
          {TESTIMONIALS.map((_, idx) => <button key={idx} aria-label={`Show testimonial ${idx + 1}`} onClick={() => setI(idx)} className={`h-2 rounded-full transition-all ${idx === i ? "w-7 bg-brand-blue" : "w-2 bg-[#d0dcf5] hover:bg-[#b9c9ee]"}`} />)}
        </div>
        <div className="flex gap-2">
          <button onClick={() => go(-1)} aria-label="Previous testimonial" className="grid size-10 place-items-center rounded-full border border-border-soft text-lg text-ink-soft transition hover:-translate-y-0.5 hover:border-brand-blue hover:text-brand-blue">&lsaquo;</button>
          <button onClick={() => go(1)} aria-label="Next testimonial" className="grid size-10 place-items-center rounded-full border border-border-soft text-lg text-ink-soft transition hover:-translate-y-0.5 hover:border-brand-blue hover:text-brand-blue">&rsaquo;</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Feature screenshot carousel ---------- */
const FEATURE_SLIDES = [
  { label: "Student dashboard", desc: "A personal space for students to track progress, schedules and updates.", src: "/images/features/student-dashboard.png", variant: "dashboard", accent: "#2159e8", points: ["Track assignments and grades", "View class schedules", "Stay informed and engaged"] },
  { label: "Exam management", desc: "Plan, schedule and manage examinations across classes with ease.", src: "/images/features/exam-management.png", variant: "table", accent: "#178a4c", points: ["Create and schedule exams", "Organise by class and term", "Cut down manual paperwork"] },
  { label: "Result management", desc: "Compile, approve and publish results with a clear audit trail.", src: "/images/features/result-management.png", variant: "table", accent: "#b9540f", points: ["Compile scores automatically", "Approve before publishing", "Share with parents securely"] },
  { label: "School admin portal", desc: "Run day-to-day operations from one organised, reliable workspace.", src: "/images/features/admin-portal.png", variant: "dashboard", accent: "#6b2fb3", points: ["Manage people and roles", "Oversee multiple branches", "Stay fully in control"] },
  { label: "Financial management", desc: "Track payments, approvals and reconciliation in real time.", src: "/images/features/financial-management.png", variant: "chart", accent: "#2159e8", points: ["Record and approve payments", "Generate receipts", "Reconcile with confidence"] },
];

/* On-brand UI mockups shown until real screenshots are dropped into /public/images/features */
function MockStats({ accent }: { accent: string }) {
  return <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="rounded-[10px] border border-[#e1e9f7] bg-white p-2.5"><i className="block h-2 w-8 rounded-full" style={{ backgroundColor: i === 0 ? accent : "#dae6fb" }} /><i className="mt-2 block h-3.5 w-2/3 rounded bg-[#eef3fb]" /></div>)}</div>;
}
function MockChart({ accent }: { accent: string }) {
  return <div className="rounded-[10px] border border-[#e1e9f7] bg-white p-3"><div className="flex h-[92px] items-end gap-1.5">{[42, 66, 50, 82, 60, 92, 70].map((h, i) => <i key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, backgroundColor: i % 2 ? `${accent}55` : accent }} />)}</div></div>;
}
function MockRows({ n, accent }: { n: number; accent: string }) {
  return <div className="mt-2.5 rounded-[10px] border border-[#e1e9f7] bg-white p-2.5"><div className="mb-2.5 flex gap-2"><i className="h-2.5 w-14 rounded-full" style={{ backgroundColor: `${accent}40` }} /><i className="h-2.5 w-10 rounded-full bg-[#e7eefc]" /><i className="ml-auto h-2.5 w-8 rounded-full bg-[#e7eefc]" /></div><div className="grid gap-2">{Array.from({ length: n }).map((_, i) => <div key={i} className="flex items-center gap-2"><i className="size-4 shrink-0 rounded-full bg-[#eef3fb]" /><i className="h-2.5 flex-1 rounded-full bg-[#f1f5fc]" /><i className="h-2.5 w-10 shrink-0 rounded-full bg-[#eef3fb]" /></div>)}</div></div>;
}
function FeatureMock({ variant, accent, label }: { variant: string; accent: string; label: string }) {
  return (
    <div className="min-h-[300px] overflow-hidden rounded-[15px] border border-[#dbe5f8] bg-[linear-gradient(135deg,#fff,#f3f7ff)] shadow-[0_16px_30px_rgba(16,33,63,.12)]">
      <div className="flex items-center gap-1.5 border-b border-[#e6edfa] bg-white/70 px-3.5 py-2.5"><i className="size-[7px] rounded-full bg-[#ff6058]" /><i className="size-[7px] rounded-full bg-[#ffbe2f]" /><i className="size-[7px] rounded-full bg-[#2aca44]" /><span className="ml-2 truncate text-[9px] font-bold text-ink-soft">{label}</span></div>
      <div className="grid grid-cols-[42px_1fr] gap-3 p-3.5">
        <div className="flex flex-col items-center gap-2.5 rounded-[10px] py-3" style={{ backgroundColor: accent }}><i className="size-5 rounded-md bg-white" />{[0, 1, 2].map((i) => <i key={i} className="size-5 rounded-md bg-white/30" />)}</div>
        <div>
          <div className="mb-2.5"><i className="block h-3 w-24 rounded-full" style={{ backgroundColor: `${accent}66` }} /><i className="mt-1.5 block h-2 w-32 rounded-full bg-[#e7eefc]" /></div>
          {variant === "chart" ? <MockChart accent={accent} /> : <MockStats accent={accent} />}
          <MockRows n={variant === "chart" ? 3 : 4} accent={accent} />
        </div>
      </div>
    </div>
  );
}

function SlideImage({ slide }: { slide: (typeof FEATURE_SLIDES)[number] }) {
  // Show the on-brand mockup by default; swap to a real screenshot only once it loads successfully.
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative min-h-[300px]">
      {!loaded && <FeatureMock variant={slide.variant} accent={slide.accent} label={slide.label} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={slide.src} alt={`${slide.label} screenshot`} onLoad={() => setLoaded(true)} className={`h-full max-h-[360px] w-full rounded-[15px] border border-[#dbe5f8] object-cover object-top shadow-[0_16px_30px_rgba(16,33,63,.12)] ${loaded ? "" : "hidden"}`} />
    </div>
  );
}

export function FeatureCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = FEATURE_SLIDES.length;
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((p) => (p + 1) % n), 5000);
    return () => clearInterval(t);
  }, [paused, n]);
  const go = (d: number) => setActive((p) => (p + d + n) % n);
  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} className="rounded-[24px] border border-border-soft bg-white p-5 shadow-[0_14px_40px_rgba(16,33,63,.09)] sm:p-7">
      <div className="overflow-hidden">
        <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${active * 100}%)` }}>
          {FEATURE_SLIDES.map((s) => (
            <div key={s.label} className="w-full shrink-0">
              <div className="grid items-center gap-7 lg:grid-cols-[.9fr_2.1fr]">
                <div>
                  <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-brand-blue">Active module</span>
                  <h3 className="mt-3 font-display text-[28px] font-semibold leading-[1.14] sm:text-[32px]">{s.label}</h3>
                  <p className="mt-3 text-[14px] leading-[1.8] text-ink-soft">{s.desc}</p>
                  <div className="mt-5 grid gap-2.5 text-[12px] text-ink-soft">
                    {s.points.map((p) => <div key={p}><span className="mr-2 font-extrabold text-brand-green">&#10003;</span>{p}</div>)}
                  </div>
                </div>
                <div className="min-h-[300px]"><SlideImage slide={s} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-2" aria-label="Feature slides">
          {FEATURE_SLIDES.map((s, idx) => <button key={s.label} aria-label={s.label} onClick={() => setActive(idx)} className={`h-2 rounded-full transition-all ${idx === active ? "w-7 bg-brand-blue" : "w-2 bg-[#d0dcf5] hover:bg-[#b9c9ee]"}`} />)}
        </div>
        <div className="flex gap-2">
          <button onClick={() => go(-1)} aria-label="Previous feature" className="grid size-10 place-items-center rounded-full border border-border-soft text-lg text-ink-soft transition hover:-translate-y-0.5 hover:border-brand-blue hover:text-brand-blue">&lsaquo;</button>
          <button onClick={() => go(1)} aria-label="Next feature" className="grid size-10 place-items-center rounded-full border border-border-soft text-lg text-ink-soft transition hover:-translate-y-0.5 hover:border-brand-blue hover:text-brand-blue">&rsaquo;</button>
        </div>
      </div>
    </div>
  );
}
