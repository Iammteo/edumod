import Image from "next/image";
import Link from "next/link";

const floatingFeatures = [
  ["Attendance", "1,248", "Students present", "👥", "left-0 top-8 lg:left-2"],
  ["Finance", "₦120,000", "Payment approved", "₦", "right-0 top-8 lg:right-2"],
  ["Results", "78", "Reports ready", "▣", "left-0 top-[11.6rem] lg:left-[-0.25rem]"],
  ["Analytics", "24%", "Attendance trend", "▥", "right-0 top-[11.6rem] lg:right-[-0.25rem]"],
  ["Communication", "126", "Parents notified", "✉", "left-6 bottom-6 lg:left-8"],
  ["Audit trail", "100%", "Actions logged", "◈", "right-6 bottom-6 lg:right-8"],
];

const comparisons = [
  ["Records in different places", "Information is scattered and hard to find.", "One connected workspace", "Your school information lives in one secure place."],
  ["Delayed information", "Decisions are based on yesterday’s data.", "Real-time visibility", "See what is happening as it happens."],
  ["Difficult tracking and reporting", "Payments, approvals and reports are hard to reconcile.", "Clear reports and insights", "Every payment, transaction and activity is traceable."],
  ["More time spent on admin", "Less time for teaching, learning and growth.", "More time for what matters", "Streamlined operations empower your team."],
];

const faqs = [
  ["What is Edumod?", "Edumod is a modular school management platform that brings operations, records, finance, academics and communication into one organised workspace."],
  ["Can I try Edumod before subscribing?", "Yes. Book a guided demo and we will walk you through the experience using a sample school workspace."],
  ["Is my school data secure?", "Edumod is designed around controlled access, permanent audit records and careful separation of school data."],
  ["Can I import my existing data?", "Yes. Our onboarding process is designed to help you move existing student and school records into Edumod safely."],
  ["Is training and support provided?", "Yes. We provide guided onboarding and support for the people who will use Edumod every day."],
  ["Can Edumod work for multi-branch schools?", "The architecture supports multiple schools and branches while keeping each school’s data appropriately separated."],
];

function Logo({ inverse = false }: { inverse?: boolean }) {
  return <span className="inline-flex items-center gap-2.5 font-display text-[22px] font-semibold tracking-tight"><span aria-hidden className="grid size-6 rotate-45 place-items-center border-2 border-brand-green"><i className="size-[7px] border-2 border-brand-green" /></span><span>Edumod<small className={`mt-0.5 block font-ui text-[9px] font-bold tracking-normal ${inverse ? "text-blue-100" : "text-ink-soft"}`}>by Klavoir Technology</small></span></span>;
}

function PrimaryButton({ children, href }: { children: React.ReactNode; href: string }) {
  return <a href={href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-brand-blue px-[18px] text-[13px] font-extrabold text-white shadow-[0_8px_18px_rgba(33,89,232,.18)] transition hover:bg-brand-dark">{children}</a>;
}
function OutlineButton({ children, href }: { children: React.ReactNode; href: string }) {
  return <a href={href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-[#b9c9ee] bg-white px-[18px] text-[13px] font-extrabold text-brand-dark transition hover:border-brand-blue hover:bg-brand-soft">{children}</a>;
}

export function LandingPage() {
  return <>
    <header className="mx-auto flex h-[78px] w-[min(1180px,calc(100%-48px))] items-center justify-between gap-7 border-b border-border-soft">
      <Link href="/" aria-label="Edumod home"><Logo /></Link>
      <nav className="hidden items-center gap-7 text-[13px] font-bold text-ink-soft lg:flex" aria-label="Primary navigation"><a className="hover:text-brand-blue" href="#why">Why Edumod</a><a className="hover:text-brand-blue" href="#platform">Platform</a><a className="hover:text-brand-blue" href="#pricing">Pricing</a><a className="hover:text-brand-blue" href="#resources">Resources</a><a className="hover:text-brand-blue" href="#about">About us</a></nav>
      <div className="flex gap-3"><Link className="hidden min-h-11 items-center justify-center rounded-[10px] border border-[#b9c9ee] bg-white px-[18px] text-[13px] font-extrabold text-brand-dark sm:inline-flex" href="/login">Log in</Link><PrimaryButton href="#demo">Book a demo</PrimaryButton></div>
    </header>

    <main>
      <section className="mx-auto grid w-[min(1180px,calc(100%-48px))] items-center gap-12 py-12 sm:py-[78px] lg:grid-cols-[.95fr_1.05fr] lg:gap-[52px]">
        <div>
          <h1 className="max-w-[620px] font-display text-[clamp(44px,5vw,70px)] leading-[1.05] font-semibold tracking-[-.055em]">Modern school management, <span className="text-brand-blue">built for the future</span></h1>
          <p className="mt-6 max-w-[560px] text-[15px] leading-[1.85] text-ink-soft">Education is evolving, and the schools that thrive are the ones equipped to adapt. Edumod brings together administration, finance, academics and communication in one trusted platform, empowering school leaders with the clarity, confidence and control they need to lead effectively.</p>
          <p className="mt-5 max-w-[560px] text-[15px] leading-[1.85] text-ink-soft">As the world evolves, schools deserve tools that help them evolve too.</p>
          <div className="mt-7 flex flex-wrap gap-3.5"><PrimaryButton href="#demo">Book a demo <span aria-hidden>→</span></PrimaryButton><OutlineButton href="#platform">Explore the platform <span aria-hidden>→</span></OutlineButton></div>
        </div>
        <div className="relative isolate min-h-[500px] overflow-visible" aria-label="Edumod features overview">
          <div className="absolute inset-x-4 bottom-9 top-16 -z-10 rounded-full bg-[radial-gradient(circle,#e8f0ff_0_45%,transparent_67%)]" />
          <div className="absolute bottom-5 left-1/2 -z-10 size-[430px] -translate-x-1/2 rounded-full border border-dashed border-brand-blue/35" />
          <Image className="absolute bottom-0 left-1/2 z-10 h-auto max-h-[465px] w-[min(365px,72%)] -translate-x-1/2 object-contain object-bottom drop-shadow-[0_22px_20px_rgba(16,33,63,.16)]" src="/images/hero-school-leader.png" alt="School leader using a laptop" width={1100} height={1467} priority />
          {floatingFeatures.map(([label, value, meta, icon, position], index) => <div key={label} className={`absolute z-20 w-40 rounded-2xl border border-border-soft bg-white p-4 shadow-[0_14px_40px_rgba(16,33,63,.09)] motion-safe:animate-[float_5s_ease-in-out_infinite] ${position}`} style={{ animationDelay: `${index * .3}s` }}>
            <div className="flex items-center gap-2 text-[11px] font-extrabold text-ink-soft"><span className="grid size-[26px] place-items-center rounded-lg bg-brand-soft text-brand-blue">{icon}</span>{label}</div><div className="mt-2.5 font-display text-[27px] leading-none font-semibold">{value}</div><div className="mt-1.5 text-[10px] text-[#8d98aa]">{meta}</div>
          </div>)}
        </div>
      </section>

      <section id="why" className="py-16 sm:py-[88px]">
        <div className="mx-auto grid w-[min(1180px,calc(100%-48px))] items-start gap-12 lg:grid-cols-[.7fr_1.3fr] lg:gap-[58px]">
          <div><span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1.5 text-[10px] font-extrabold tracking-[.08em] text-brand-blue uppercase">A clearer way to run your school</span><h2 className="mt-4 font-display text-[38px] leading-[1.13] font-semibold tracking-[-.03em]">From scattered information to total clarity</h2><p className="mt-4 text-[14px] leading-[1.85] text-ink-soft">Managing a school means keeping track of people, payments, records and everyday activity. When information is scattered across paper files, spreadsheets and different tools, it becomes harder to see what is happening and harder to make confident decisions.</p><p className="mt-4 text-[14px] leading-[1.85] text-ink-soft">Edumod brings the important parts of school management into one organised, reliable system, so your team can work with greater clarity every day.</p></div>
          <div className="grid gap-3.5 rounded-[24px] border border-border-soft bg-white p-5 shadow-[0_14px_40px_rgba(16,33,63,.09)] sm:grid-cols-[1fr_54px_1fr] sm:p-7"><CompareColumn title="Without clarity" items={comparisons.map(([a,b]) => [a,b])} /><div className="hidden place-items-center text-2xl text-[#9bb3ed] sm:grid">→</div><CompareColumn title="With Edumod" items={comparisons.map(([, ,c,d]) => [c,d])} /></div>
        </div>
      </section>

      <section id="platform" className="py-16 sm:py-[88px]"><div className="mx-auto w-[min(1180px,calc(100%-48px))]"><div className="mx-auto mb-10 max-w-[650px] text-center"><span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1.5 text-[10px] font-extrabold tracking-[.08em] text-brand-blue uppercase">Everything your school needs</span><h2 className="mt-3.5 font-display text-[clamp(30px,3.5vw,48px)] leading-[1.1] font-semibold tracking-[-.03em]">Everything your school needs, in one place</h2><p className="mt-2.5 text-[14px] leading-7 text-ink-soft">Explore focused workspaces built for the people and processes that keep a school moving.</p></div><ProductShowcase /></div></section>

      <section className="py-16 sm:py-[88px]"><div className="mx-auto grid w-[min(1180px,calc(100%-48px))] items-start gap-10 lg:grid-cols-[.6fr_1.4fr] lg:gap-[46px]"><div><span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1.5 text-[10px] font-extrabold tracking-[.08em] text-brand-blue uppercase">FAQs</span><h2 className="mt-3.5 font-display text-[38px] leading-[1.12] font-semibold tracking-[-.03em]">Frequently asked questions</h2><p className="mt-4 text-[14px] leading-[1.8] text-ink-soft">Everything you need to know about Edumod before getting started.</p></div><div className="grid gap-3">{faqs.map(([question,answer]) => <details className="group rounded-xl border border-border-soft bg-white px-[18px]" key={question}><summary className="relative cursor-pointer list-none py-[18px] pr-7 text-[13px] font-extrabold after:absolute after:right-0 after:top-2.5 after:text-xl after:font-medium after:text-brand-blue after:content-['+'] group-open:after:content-['−']">{question}</summary><p className="pb-[17px] text-[13px] leading-7 text-ink-soft">{answer}</p></details>)}</div></div></section>
    </main>
    <footer id="about" className="mt-16 bg-[linear-gradient(115deg,#0d2f75,#174bba)] py-[46px] text-white"><div className="mx-auto grid w-[min(1180px,calc(100%-48px))] gap-7 sm:grid-cols-2 lg:grid-cols-[1.25fr_repeat(3,1fr)]"><div><Link href="/"><Logo inverse /></Link><h3 className="mt-3 font-display text-2xl leading-tight font-semibold">Modern tools for schools moving forward.</h3></div><FooterLinks heading="Product" items={["School management","Financial management","Attendance"]}/><FooterLinks heading="Company" items={["About us","Contact","Careers"]}/><FooterLinks heading="Support" items={["Help centre","Privacy policy","Terms of service"]}/></div></footer>
  </>;
}
function CompareColumn({ title, items }: { title: string; items: string[][] }) { return <div><h3 className="mb-3.5 text-[10px] font-bold tracking-[.09em] text-ink-soft uppercase">{title}</h3>{items.map(([heading,copy]) => <div className="min-h-20 border-b border-border-soft py-3.5 last:border-0" key={heading}><strong className="block text-[13px]">{heading}</strong><span className="mt-1 block text-[11px] leading-[1.5] text-ink-soft">{copy}</span></div>)}</div> }
function FooterLinks({ heading, items }: { heading: string; items: string[] }) { return <div><strong>{heading}</strong><ul className="mt-3 space-y-1 text-[12px] leading-6 text-blue-100">{items.map(item => <li key={item}>{item}</li>)}</ul></div> }
function ProductShowcase() { const labels = ["Student dashboard", "Exam management software", "Result management", "School admin portal", "Financial management portal"]; return <div className="rounded-[24px] border border-border-soft bg-white p-5 shadow-[0_14px_40px_rgba(16,33,63,.09)] sm:p-[34px]"><div className="grid items-center gap-8 lg:grid-cols-[.9fr_2.1fr]"><div><span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1.5 text-[10px] font-extrabold tracking-[.08em] text-brand-blue uppercase">Active module</span><h3 className="mt-3 font-display text-[32px] leading-[1.14] font-semibold">Student dashboard</h3><p className="mt-3 text-[14px] leading-[1.8] text-ink-soft">Give students a personal space to stay updated, track progress and access what they need anytime.</p><div className="mt-5 grid gap-2.5 text-[12px] text-ink-soft"><div><span className="mr-2 font-extrabold text-brand-green">✓</span>Track assignments and grades</div><div><span className="mr-2 font-extrabold text-brand-green">✓</span>View class schedules</div><div><span className="mr-2 font-extrabold text-brand-green">✓</span>Stay informed and engaged</div></div></div><div className="min-h-[330px] rounded-[15px] border border-[#dbe5f8] bg-[linear-gradient(135deg,#fff,#f3f7ff)] p-[15px] shadow-[0_16px_30px_rgba(16,33,63,.12)]"><div className="flex h-[22px] items-center gap-1.5"><i className="size-[7px] rounded-full bg-[#d5e0f5]"/><i className="size-[7px] rounded-full bg-[#d5e0f5]"/><i className="size-[7px] rounded-full bg-[#d5e0f5]"/></div><div className="grid grid-cols-[58px_1fr] gap-3 pt-2"><div className="min-h-[266px] rounded-[10px] bg-ink"/><div className="grid grid-cols-[1.1fr_.9fr] gap-2.5"><MockBox/><MockBox/><div className="col-span-2 min-h-[150px] rounded-[10px] border border-[#e1e9f7] bg-white p-2.5"><div className="mb-3 flex gap-2"><i className="h-3 w-12 rounded-full bg-[#e7eefc]"/><i className="h-3 w-12 rounded-full bg-[#e7eefc]"/><i className="h-3 w-12 rounded-full bg-[#e7eefc]"/></div><div className="grid gap-2.5">{Array.from({ length: 7 }).map((_,i)=><i className="h-2.5 rounded-full bg-[#eef3fb]" key={i}/>)}</div></div></div></div></div></div><div className="mt-5 flex justify-center gap-2" aria-label="Product carousel"><button className="h-2 w-[22px] rounded-full bg-brand-blue" aria-label="Student dashboard"/>{labels.slice(1).map(label => <button className="size-2 rounded-full bg-[#d0dcf5]" key={label} aria-label={label}/>)}</div></div> }
function MockBox() { return <div className="min-h-[74px] rounded-[10px] border border-[#e1e9f7] bg-white p-2.5"><div className="my-1.5 h-[7px] w-3/4 rounded-full bg-[#5d85ef]"/><div className="my-1.5 h-[7px] rounded-full bg-[#dae6fb]"/><div className="my-1.5 h-[7px] rounded-full bg-[#dae6fb]"/></div> }
