import Image from "next/image";
import Link from "next/link";
import { Logo, navLinks } from "./brand";
import { FeatureCarousel, Reveal, Testimonials } from "./interactive";

const floatingFeatures = [
  ["Attendance", "1,248", "Students present", "users", "left-0 top-8 lg:left-2"],
  ["Finance", "₦120,000", "Payment approved", "banknote", "right-0 top-8 lg:right-2"],
  ["Results", "78", "Reports ready", "file", "left-0 top-[11.6rem] lg:left-[-0.25rem]"],
  ["Analytics", "24%", "Attendance trend", "trend", "right-0 top-[11.6rem] lg:right-[-0.25rem]"],
  ["Communication", "126", "Parents notified", "mail", "left-6 bottom-6 lg:left-8"],
  ["Audit trail", "100%", "Actions logged", "shield", "right-6 bottom-6 lg:right-8"],
];

const featureIcons: Record<string, React.ReactNode> = {
  users: <><path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" /><circle cx="9" cy="7" r="3" /><path d="M22 19v-1a4 4 0 0 0-3-3.87" /><path d="M16 4.13a4 4 0 0 1 0 7.75" /></>,
  banknote: <><rect width="20" height="12" x="2" y="6" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="m9 15 2 2 4-4" /></>,
  trend: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
  mail: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  shield: <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>,
  layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></>,
  bolt: <><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></>,
  coins: <><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

function FeatureIcon({ name, className = "size-[11px] sm:size-[15px]" }: { name: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>{featureIcons[name]}</svg>;
}

function FeatureCardBody({ label, value, meta, icon }: { label: string; value: string; meta: string; icon: string }) {
  return <>
    <div className="flex items-center gap-1 text-[8px] font-extrabold leading-tight text-ink-soft sm:gap-2 sm:text-[11px] sm:leading-normal"><span className="grid size-[16px] shrink-0 place-items-center rounded bg-brand-soft text-brand-blue sm:size-[26px] sm:rounded-lg"><FeatureIcon name={icon} /></span>{label}</div>
    <div className="mt-1 font-display text-[14px] leading-none font-semibold sm:mt-2.5 sm:text-[27px]">{value}</div>
    <div className="mt-0.5 text-[8px] leading-tight text-[#8d98aa] sm:mt-1.5 sm:text-[10px]">{meta}</div>
  </>;
}

const comparisons = [
  { icon: "layers", color: "#2159e8", without: ["Records in different places", "Information is scattered and hard to find."], with: ["One connected workspace", "Your school information lives in one secure place."] },
  { icon: "bolt", color: "#178a4c", without: ["Delayed information", "Decisions are based on yesterday’s data."], with: ["Real-time visibility", "See what is happening as it happens."] },
  { icon: "coins", color: "#b9540f", without: ["Difficult tracking and reporting", "Payments, approvals and reports are hard to reconcile."], with: ["Clear reports and insights", "Every payment, transaction and activity is traceable."] },
  { icon: "clock", color: "#6b2fb3", without: ["More time spent on admin", "Less time for teaching, learning and growth."], with: ["More time for what matters", "Streamlined operations empower your team."] },
];

const faqs = [
  ["What is Edumod?", "Edumod is a modular school management platform that brings operations, records, finance, academics and communication into one organised workspace."],
  ["Can I try Edumod before subscribing?", "Yes. Book a guided demo and we will walk you through the experience using a sample school workspace."],
  ["Is my school data secure?", "Edumod is designed around controlled access, permanent audit records and careful separation of school data."],
  ["Can I import my existing data?", "Yes. Our onboarding process is designed to help you move existing student and school records into Edumod safely."],
  ["Is training and support provided?", "Yes. We provide guided onboarding and support for the people who will use Edumod every day."],
  ["Can Edumod work for multi-branch schools?", "The architecture supports multiple schools and branches while keeping each school’s data appropriately separated."],
];

function PrimaryButton({ children, href }: { children: React.ReactNode; href: string }) {
  return <a href={href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-brand-blue px-[18px] text-[13px] font-extrabold text-white shadow-[0_8px_18px_rgba(33,89,232,.18)] transition hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-[0_12px_24px_rgba(33,89,232,.28)]">{children}</a>;
}
function OutlineButton({ children, href }: { children: React.ReactNode; href: string }) {
  return <a href={href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-[#b9c9ee] bg-white px-[18px] text-[13px] font-extrabold text-brand-dark transition hover:-translate-y-0.5 hover:border-brand-blue hover:bg-brand-soft">{children}</a>;
}

export function LandingPage() {
  return <>
    <header className="relative z-50 mx-auto flex h-[78px] w-[min(1180px,calc(100%-48px))] items-center justify-between gap-7 border-b border-border-soft">
      <Link href="/" aria-label="Edumod home"><Logo /></Link>
      <nav className="hidden items-center gap-7 text-[13px] font-bold text-ink-soft lg:flex" aria-label="Primary navigation">{navLinks.map(([label, href]) => <a className="hover:text-brand-blue" href={href} key={href}>{label}</a>)}</nav>
      <div className="hidden gap-3 lg:flex"><Link className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#b9c9ee] bg-white px-[18px] text-[13px] font-extrabold text-brand-dark" href="/login">Log in</Link><PrimaryButton href="/contact">Book a demo</PrimaryButton></div>
      <details className="group relative lg:hidden [&_summary::-webkit-details-marker]:hidden">
        <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-[10px] border border-[#b9c9ee] bg-white text-brand-dark transition hover:border-brand-blue" aria-label="Toggle menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden className="size-5">
            <line x1="3" y1="6" x2="21" y2="6" className="group-open:hidden" /><line x1="3" y1="12" x2="21" y2="12" className="group-open:hidden" /><line x1="3" y1="18" x2="21" y2="18" className="group-open:hidden" />
            <line x1="5" y1="5" x2="19" y2="19" className="hidden group-open:block" /><line x1="19" y1="5" x2="5" y2="19" className="hidden group-open:block" />
          </svg>
        </summary>
        <div className="absolute right-0 top-[calc(100%+14px)] flex w-60 flex-col gap-1 rounded-2xl border border-border-soft bg-white p-3 shadow-[0_20px_50px_rgba(16,33,63,.16)]">
          {navLinks.map(([label, href]) => <a className="rounded-lg px-3 py-2.5 text-[14px] font-bold text-ink-soft transition hover:bg-brand-soft hover:text-brand-blue" href={href} key={href}>{label}</a>)}
          <div className="mt-2 grid gap-2 border-t border-border-soft pt-3">
            <Link className="flex min-h-11 items-center justify-center rounded-[10px] border border-[#b9c9ee] bg-white px-[18px] text-[13px] font-extrabold text-brand-dark" href="/login">Log in</Link>
            <PrimaryButton href="/contact">Book a demo</PrimaryButton>
          </div>
        </div>
      </details>
    </header>

    <main>
      <section className="mx-auto grid w-[min(1180px,calc(100%-48px))] items-center gap-12 py-12 sm:py-[78px] lg:grid-cols-[.95fr_1.05fr] lg:gap-[52px]">
        <div className="order-2 sm:order-1">
          <h1 className="max-w-[640px] font-display text-[32px] leading-[1.1] font-extrabold tracking-[-.045em] sm:text-[clamp(44px,5vw,70px)] sm:leading-[1.04]">Modern school management, <span className="text-brand-blue">built for the future</span></h1>
          <p className="mt-6 max-w-[560px] text-[15px] leading-[1.85] text-ink-soft">Education is evolving, and the schools that thrive are the ones equipped to adapt. Edumod brings together administration, finance, academics and communication in one trusted platform, empowering school leaders with the clarity, confidence and control they need to lead effectively.</p>
          <p className="mt-5 max-w-[560px] text-[15px] leading-[1.85] text-ink-soft">As the world evolves, schools deserve tools that help them evolve too.</p>
          <div className="mt-7 flex flex-wrap gap-3.5"><PrimaryButton href="/contact">Book a demo <span aria-hidden>→</span></PrimaryButton><OutlineButton href="#platform">Explore the platform <span aria-hidden>→</span></OutlineButton></div>
        </div>
        <div className="relative isolate order-1 min-h-[380px] overflow-visible sm:order-2 sm:min-h-[500px]" aria-label="Edumod features overview">
          <div className="absolute inset-x-4 bottom-9 top-16 -z-10 rounded-full bg-[radial-gradient(circle,#e8f0ff_0_45%,transparent_67%)]" />
          <div className="absolute bottom-5 left-1/2 -z-10 size-[240px] -translate-x-1/2 rounded-full border border-dashed border-brand-blue/35 sm:size-[430px]" />
          <Image className="absolute bottom-0 left-1/2 z-10 h-auto max-h-[300px] w-[min(220px,60%)] -translate-x-1/2 object-contain object-bottom drop-shadow-[0_22px_20px_rgba(16,33,63,.16)] sm:max-h-[465px] sm:w-[min(365px,72%)]" src="/images/hero-school-leader.png" alt="School leader using a laptop" width={447} height={558} priority />
          {floatingFeatures.map(([label, value, meta, icon, position], index) => <div key={label} className={`absolute z-20 w-[94px] rounded-lg border border-border-soft bg-white p-2 shadow-[0_14px_40px_rgba(16,33,63,.09)] transition-shadow duration-300 hover:shadow-[0_20px_50px_rgba(33,89,232,.22)] motion-safe:animate-[float_5s_ease-in-out_infinite] sm:w-40 sm:rounded-2xl sm:p-4 ${position}`} style={{ animationDelay: `${index * .3}s` }}>
            <FeatureCardBody label={label} value={value} meta={meta} icon={icon} />
          </div>)}
        </div>
      </section>

      <section id="why" className="py-16 sm:py-[88px]">
        <div className="mx-auto grid w-[min(1180px,calc(100%-48px))] items-start gap-12 lg:grid-cols-[.7fr_1.3fr] lg:gap-[58px]">
          <Reveal>
            <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-brand-blue">A clearer way to run your school</span>
            <h2 className="mt-4 font-display text-[clamp(28px,3.4vw,38px)] font-semibold leading-[1.13] tracking-[-.03em]">From scattered information to total clarity</h2>
            <p className="mt-4 text-[14px] leading-[1.85] text-ink-soft">Managing a school means keeping track of people, payments, records and everyday activity. When information is scattered across paper files, spreadsheets and different tools, it becomes harder to see what is happening and harder to make confident decisions.</p>
            <p className="mt-4 text-[14px] leading-[1.85] text-ink-soft">Edumod brings the important parts of school management into one organised, reliable system, so your team can work with greater clarity every day.</p>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-[24px] border border-border-soft bg-white p-3 shadow-[0_14px_40px_rgba(16,33,63,.09)] sm:p-7">
              <div className="mb-3 grid grid-cols-[1fr_16px_1fr] items-center gap-2 sm:mb-4 sm:grid-cols-[1fr_54px_1fr] sm:gap-3">
                <span className="text-center text-[8px] font-bold uppercase tracking-[.08em] text-ink-soft sm:text-[10px] sm:tracking-[.09em]">Without clarity</span>
                <span />
                <span className="text-center"><span className="inline-flex rounded-full bg-brand-soft px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[.06em] text-brand-blue sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[.08em]">With Edumod</span></span>
              </div>
              <div className="grid gap-2 sm:gap-3.5">
                {comparisons.map((c) => <div key={c.icon} className="grid grid-cols-[1fr_16px_1fr] items-stretch gap-2 sm:grid-cols-[1fr_54px_1fr] sm:gap-3">
                  <CompareCell kind="without" icon={c.icon} title={c.without[0]} copy={c.without[1]} />
                  <div aria-hidden className="flex items-center justify-center text-sm text-[#9bb3ed] sm:text-xl">→</div>
                  <CompareCell kind="with" icon={c.icon} title={c.with[0]} copy={c.with[1]} color={c.color} />
                </div>)}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="platform" className="py-16 sm:py-[88px]"><div className="mx-auto w-[min(1180px,calc(100%-48px))]"><Reveal className="mx-auto mb-10 max-w-[650px] text-center"><span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-brand-blue">Everything your school needs</span><h2 className="mt-3.5 font-display text-[clamp(30px,3.5vw,48px)] font-semibold leading-[1.1] tracking-[-.03em]">Everything your school needs, in one place</h2><p className="mt-2.5 text-[14px] leading-7 text-ink-soft">Explore focused workspaces built for the people and processes that keep a school moving.</p></Reveal><Reveal delay={120}><FeatureCarousel /></Reveal></div></section>

      <section className="py-16 sm:py-[88px]"><div className="mx-auto w-[min(1180px,calc(100%-48px))]"><Reveal className="mx-auto mb-10 max-w-[640px] text-center"><span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-brand-blue">Loved by school leaders</span><h2 className="mt-3.5 font-display text-[clamp(28px,3.5vw,44px)] font-semibold leading-[1.1] tracking-[-.03em]">Trusted by schools moving forward</h2><p className="mt-2.5 text-[14px] leading-7 text-ink-soft">Hear from the people running schools on Edumod every day.</p></Reveal><Reveal delay={120}><Testimonials /></Reveal></div></section>

      <section className="py-16 sm:py-[88px]"><div className="mx-auto grid w-[min(1180px,calc(100%-48px))] items-start gap-10 lg:grid-cols-[.6fr_1.4fr] lg:gap-[46px]"><Reveal><span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-brand-blue">FAQs</span><h2 className="mt-3.5 font-display text-[38px] font-semibold leading-[1.12] tracking-[-.03em]">Frequently asked questions</h2><p className="mt-4 text-[14px] leading-[1.8] text-ink-soft">Everything you need to know about Edumod before getting started.</p></Reveal><Reveal delay={100} className="grid gap-3">{faqs.map(([question,answer]) => <details className="group rounded-xl border border-border-soft bg-white px-[18px] transition hover:border-brand-blue/40" key={question}><summary className="relative cursor-pointer list-none py-[18px] pr-7 text-[13px] font-extrabold after:absolute after:right-0 after:top-2.5 after:text-xl after:font-medium after:text-brand-blue after:transition-transform after:content-['+'] group-open:after:rotate-45">{question}</summary><p className="pb-[17px] text-[13px] leading-7 text-ink-soft">{answer}</p></details>)}</Reveal></div></section>
    </main>
    <footer id="about" className="mt-16 bg-[linear-gradient(115deg,#0d2f75,#174bba)] py-[46px] text-white"><div className="mx-auto grid w-[min(1180px,calc(100%-48px))] gap-7 sm:grid-cols-2 lg:grid-cols-[1.25fr_repeat(3,1fr)]"><div><Link href="/"><Logo inverse /></Link><h3 className="mt-3 font-display text-2xl leading-tight font-semibold">Modern tools for schools moving forward.</h3></div><FooterLinks heading="Product" items={[["School management","/#platform"],["Financial management","/#platform"],["Why Edumod","/#why"]]}/><FooterLinks heading="Company" items={[["About us","/#about"],["Contact","/contact"],["Book a demo","/contact"]]}/><FooterLinks heading="Support" items={[["Help centre","/contact"],["Privacy policy","/privacy"],["Terms of service","/terms"]]}/></div></footer>
  </>;
}
function CompareCell({ kind, icon, title, copy, color }: { kind: "without" | "with"; icon: string; title: string; copy: string; color?: string }) {
  const isWith = kind === "with";
  return <div className={`flex gap-2 rounded-xl border bg-paper/70 p-2 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(16,33,63,.08)] sm:gap-3 sm:rounded-2xl sm:p-3.5 ${isWith ? "border-brand-blue/25" : "border-border-soft"}`}>
    <span className="grid size-7 shrink-0 place-items-center rounded-lg sm:size-9 sm:rounded-xl" style={color ? { backgroundColor: `${color}1a`, color } : { backgroundColor: "#eef2f9", color: "#9aa7bd" }}><FeatureIcon name={icon} className="size-[14px] sm:size-[18px]" /></span>
    <div>
      <strong className="block text-[10px] leading-snug text-ink sm:text-[13px]">{title}</strong><span className="mt-0.5 block text-[8px] leading-snug text-ink-soft sm:mt-1 sm:text-[11px] sm:leading-[1.5]">{copy}</span>
    </div>
  </div>;
}
function FooterLinks({ heading, items }: { heading: string; items: [string, string][] }) { return <div><strong>{heading}</strong><ul className="mt-3 space-y-1 text-[12px] leading-6 text-blue-100">{items.map(([label, href]) => <li key={label}><a href={href} className="transition hover:text-white">{label}</a></li>)}</ul></div> }
