"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/client";
import { AddStudentForm, ResetStudentPasswordForm } from "./people-forms";
import { AreaLineChart, BarChart, DonutChart } from "./charts";
import { InviteWizard } from "./invite-wizard";
import { FinanceView } from "./finance-view";
import { updateSchoolProfile, uploadSchoolLogo, removeSchoolLogo } from "@/lib/actions/school";
import { AREAS, AREA_LABELS, LEVELS, type Area, type Level } from "@/lib/permissions";

export type School = { name: string; schoolCode: string; email: string | null; phone: string | null; state: string | null; country: string | null; address: string | null; logoKey: string | null };
type Student = { id: string; name: string; admissionNo: string; createdAt: string };
export type Staff = { name: string; email: string | null; role: string; teacherType: string; subjects: string[]; assignedClass: string | null; status: string; canApprove: boolean; permissions: Record<string, string> };
type Audit = { action: string; entityType: string; actor: string | null; at: string };
type Props = { userName: string; school: School; students: Student[]; staff: Staff[]; audit: Audit[]; initialSection?: string };

const I = (p: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">{p}</svg>;
const ICONS: Record<string, React.ReactNode> = {
  overview: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  students: <><path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" /><circle cx="9" cy="7" r="3" /><path d="M22 19v-1a4 4 0 0 0-3-3.87" /></>,
  staff: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  attendance: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  finance: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>,
  messages: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
  reports: <><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 5-5" /></>,
  profile: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M15 8h3M15 12h3M7 16h10" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.4l.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 11 4.6V4.5a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 19 5.4a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 11V11a2 2 0 0 1 0 4Z" /></>,
  audit: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></>,
};
const NAV: [string, string, number?][] = [["overview", "Overview"], ["students", "Students"], ["staff", "Staff"], ["attendance", "Attendance"], ["finance", "Finance"], ["messages", "Messages", 3], ["reports", "Reports"], ["profile", "Profile"], ["settings", "Settings"], ["audit", "Audit log"]];

function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }
const AV_COLORS = ["#2159e8", "#178a4c", "#b9540f", "#6b2fb3", "#0d8aa8"];
function Avatar({ name, size = 30 }: { name: string; size?: number }) { const c = AV_COLORS[name.length % AV_COLORS.length]; return <span className="grid shrink-0 place-items-center rounded-full font-extrabold text-white" style={{ width: size, height: size, backgroundColor: c, fontSize: size * 0.36 }}>{initials(name)}</span>; }

export function AdminApp({ userName, school, students, staff, audit, initialSection = "overview" }: Props) {
  const [active, setActive] = useState(initialSection);
  const [open, setOpen] = useState(false);
  const [logo, setLogo] = useState<string | null>(school.logoKey);
  const [details, setDetails] = useState(school);
  const [notifOpen, setNotifOpen] = useState(false);
  const router = useRouter();
  async function logout() { await signOut(); router.push("/login"); }

  const sidebar = (
    <>
      <div className="flex items-center gap-2.5 px-1 font-display text-[21px] font-semibold text-white">
        {logo ? <img src={logo} alt="" className="size-7 rounded-md object-cover" /> : <span className="grid size-6 rotate-45 place-items-center border-2 border-brand-green"><i className="size-[7px] border-2 border-brand-green" /></span>}Edumod
      </div>
      <div className="my-[16px] rounded-[10px] border border-white/15 p-3 text-[11px] text-[#eef4ff]"><strong className="line-clamp-1">{details.name}</strong>2023/2024 · Term 2<div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2"><span className="text-[#9fb6d8]">School code</span><code className="select-all font-extrabold tracking-wide text-white">{school.schoolCode}</code></div></div>
      <nav className="grid gap-0.5 overflow-y-auto">
        {NAV.map(([key, label, badge]) => (
          <button key={key} onClick={() => { setActive(key); setOpen(false); }} className={`flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[13px] font-bold transition ${active === key ? "bg-[#174e97] text-white" : "text-[#ced9eb] hover:bg-white/10"}`}>
            {I(ICONS[key])}<span className="flex-1 text-left">{label}</span>{badge && <span className="grid size-[18px] place-items-center rounded-full bg-brand-green text-[9px] text-white">{badge}</span>}
          </button>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 border-t border-white/15 pt-3.5"><Avatar name={userName} size={34} /><div className="min-w-0 flex-1 text-[11px] text-white"><div className="truncate font-bold">{userName}</div><div className="text-[#9fb6d8]">School Admin</div></div><button onClick={logout} aria-label="Sign out" title="Sign out" className="grid size-8 place-items-center rounded-lg text-[#9fb6d8] transition hover:bg-white/10 hover:text-white">{I(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>)}</button></div>
    </>
  );

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[244px_1fr]">
      <aside className="hidden flex-col bg-ink px-4 py-[20px] lg:flex">{sidebar}</aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} /><aside className="absolute left-0 top-0 flex h-full w-[260px] flex-col bg-ink px-4 py-[20px] motion-safe:animate-[fade-up_.2s_ease]">{sidebar}</aside></div>}

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border-soft bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid size-10 place-items-center rounded-[10px] border border-border-soft">{I(<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>)}</button>
          <span className="font-display text-[18px] font-semibold">{NAV.find((n) => n[0] === active)?.[1]}</span>
          <NotifBell open={notifOpen} setOpen={setNotifOpen} />
        </header>

        <main className="p-4 sm:p-6 lg:px-7 lg:py-6">
          {active === "overview" && <Overview userName={userName} students={students} staff={staff} audit={audit} notifOpen={notifOpen} setNotifOpen={setNotifOpen} goto={setActive} />}
          {active === "students" && <Students students={students} />}
          {active === "staff" && <StaffView staff={staff} />}
          {active === "profile" && <Profile school={details} logo={logo} onLogo={setLogo} goto={setActive} />}
          {active === "settings" && <Settings school={details} onSaved={setDetails} />}
          {active === "audit" && <AuditLog audit={audit} />}
          {active === "finance" && <FinanceView />}
          {["attendance", "messages", "reports"].includes(active) && <ComingSoon name={NAV.find((n) => n[0] === active)![1]} />}
        </main>
      </div>
    </div>
  );
}

/* ---------- shared ---------- */
function Head({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h1 className="font-display text-[clamp(21px,3.5vw,28px)] font-semibold leading-tight">{title}</h1><p className="mt-0.5 text-[13px] text-ink-soft">{subtitle}</p></div>{action}</div>;
}
function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border-soft bg-white p-5 ${className}`}>{(title || action) && <div className="mb-3.5 flex items-center justify-between"><h2 className="font-display text-[16px] font-semibold">{title}</h2>{action}</div>}{children}</section>;
}
function Select({ children }: { children: React.ReactNode }) { return <div className="inline-flex items-center gap-1.5 rounded-[9px] border border-border-soft bg-white px-3 py-1.5 text-[12px] font-bold text-ink-soft">{children}{I(<path d="m6 9 6 6 6-6" />)}</div>; }
function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; label: string }[] }) { return <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-[9px] border border-border-soft bg-white px-3 py-1.5 text-[12px] font-bold text-ink-soft outline-none focus:border-brand-blue">{options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}</select>; }
function PrimaryBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) { return <button onClick={onClick} className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] bg-brand-blue px-3.5 text-[13px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark">{children}</button>; }
function Field({ label, name, defaultValue, type = "text", placeholder }: { label: string; name: string; defaultValue?: string; type?: string; placeholder?: string }) {
  return <label className="grid gap-1.5"><span className="text-[11px] font-extrabold text-ink">{label}</span><input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} className="min-h-10 rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] text-ink outline-none transition focus:border-brand-blue focus:bg-white focus:ring-2 focus:ring-brand-blue/20" /></label>;
}
function Empty({ text }: { text: string }) { return <div className="grid place-items-center rounded-xl border border-dashed border-border-soft py-10 text-center text-[12px] text-ink-soft">{text}</div>; }
const Pill = ({ children, color = "green" }: { children: React.ReactNode; color?: "green" | "blue" }) => <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${color === "green" ? "bg-brand-green/10 text-brand-green" : "bg-brand-soft text-brand-blue"}`}><span className={`size-1.5 rounded-full ${color === "green" ? "bg-brand-green" : "bg-brand-blue"}`} />{children}</span>;

const NOTIFS = [
  ["✓", "Payment of ₦120,000 approved", "2 min ago", "#178a4c"],
  ["+", "New student added", "1 hr ago", "#2159e8", "Chiamaka Nwosu was added to JSS 2A"],
  ["▣", "Term 2 fees published", "2 hrs ago", "#b9540f", "JSS 2A fee structure is now available"],
  ["✦", "Teacher invited", "3 hrs ago", "#6b2fb3", "Mr. Okafor has joined as a teacher"],
] as const;
function NotifBell({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const [read, setRead] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full border border-border-soft bg-white text-ink-soft transition hover:text-brand-blue">{I(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>)}{!read && <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-brand-green text-[8px] font-bold text-white">4</span>}</button>
      {open && <><div className="fixed inset-0 z-40" onClick={() => setOpen(false)} /><div className="absolute right-0 top-12 z-50 w-[300px] rounded-2xl border border-border-soft bg-white p-2 shadow-[0_20px_50px_rgba(16,33,63,.16)] motion-safe:animate-[fade-up_.2s_ease]"><div className="flex items-center justify-between px-2 py-1.5"><strong className="text-[13px]">Notifications</strong><button onClick={() => setRead(true)} className="text-[11px] font-bold text-brand-blue hover:underline">Mark all as read</button></div>{NOTIFS.map(([icon, title, time, color, sub]) => <div key={title} className="flex gap-2.5 rounded-xl px-2 py-2 hover:bg-paper/70"><span className="grid size-7 shrink-0 place-items-center rounded-lg text-[12px] text-white" style={{ backgroundColor: color }}>{icon}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><strong className="text-[11px]">{title}</strong><span className="shrink-0 text-[10px] text-ink-soft">{time}</span></div>{sub && <p className="text-[10px] leading-snug text-ink-soft">{sub}</p>}</div></div>)}<button className="mt-1 w-full rounded-xl py-2 text-center text-[12px] font-extrabold text-brand-blue hover:bg-brand-soft">View all notifications →</button></div></>}
    </div>
  );
}

/* ---------- Overview ---------- */
function Overview({ userName, students, staff, audit, notifOpen, setNotifOpen, goto }: { userName: string; students: Student[]; staff: Staff[]; audit: Audit[]; notifOpen: boolean; setNotifOpen: (v: boolean) => void; goto: (s: string) => void }) {
  const totalStudents = Math.max(students.length, 1248);
  const totalStaff = Math.max(staff.length, 48);
  const jss = Math.round(totalStudents * 0.52), sss = Math.round(totalStudents * 0.26), pri = totalStudents - jss - sss;
  const stats = [
    ["Total students", totalStudents.toLocaleString(), "↑ 12 this week", "#178a4c", "#e7f6ee", ICONS.students],
    ["Teaching staff", totalStaff.toLocaleString(), "↑ 2 new", "#6b2fb3", "#f0e9fa", ICONS.staff],
    ["Attendance today", "92%", "↑ 2.4% vs yesterday", "#178a4c", "#e7f6ee", ICONS.attendance],
    ["Fees collected", "₦11.8M", "↑ 8% this month", "#b9540f", "#fbeee3", ICONS.finance],
  ] as const;
  const acts = audit.length ? audit.slice(0, 4).map((a) => [a.action, `${a.entityType} · ${a.actor ?? "system"}`] as const) : [["Payment of ₦120,000 approved", "By Mrs. A. Johnson · 2 min ago"], ["New student added", "Chiamaka Nwosu · 1 hr ago"], ["Term 2 fees published", "JSS 2A · 2 hrs ago"], ["Teacher invited", "Mr. Okafor · 3 hrs ago"]] as const;
  return (
    <>
      <Head title={`Good morning, ${userName.split(" ")[0]} 👋`} subtitle="Here's what's happening in your school today." action={<div className="flex items-center gap-2.5"><div className="hidden sm:block"><NotifBell open={notifOpen} setOpen={setNotifOpen} /></div><Select>2023/2024 · Term 2</Select></div>} />
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, trend, color, bg, icon]) => (
          <div key={label} className="rounded-2xl border border-border-soft bg-white p-[18px] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(16,33,63,.08)]">
            <div className="flex items-start justify-between"><div><small className="font-bold text-ink-soft">{label}</small><strong className="mt-2 block font-display text-[27px] font-semibold leading-none">{value}</strong></div><span className="grid size-9 place-items-center rounded-full" style={{ backgroundColor: bg, color }}>{I(icon)}</span></div>
            <span className="mt-3 inline-block text-[11px] font-extrabold text-brand-green">{trend}</span>
          </div>
        ))}
      </div>
      <div className="mt-[18px] grid gap-[18px] xl:grid-cols-[1.45fr_1fr]">
        <Card title="Attendance trend (last 7 days)" action={<Select>Last 7 days</Select>}><AreaLineChart points={[78, 84, 82, 86, 83, 88, 85]} labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} /></Card>
        <Card title="Students by section"><DonutChart total={totalStudents} segments={[{ label: "JSS", value: jss, color: "#2159e8" }, { label: "SSS", value: sss, color: "#178a4c" }, { label: "Primary", value: pri, color: "#b9540f" }]} /><button onClick={() => goto("reports")} className="mt-4 w-full rounded-[10px] border border-border-soft py-2 text-[12px] font-extrabold text-brand-blue transition hover:bg-brand-soft">View report</button></Card>
      </div>
      <div className="mt-[18px] grid gap-[18px] xl:grid-cols-[1.45fr_1fr]">
        <Card title="Fee collection (₦, last 6 months)" action={<Select>Last 6 months</Select>}><BarChart yMax={15_000_000} yLabel={(n) => `${Math.round(n / 1_000_000)}M`} data={[["Jan", 7.5], ["Feb", 9.8], ["Mar", 8.6], ["Apr", 11.4], ["May", 10.2], ["Jun", 13.2]].map(([l, v]) => ({ label: l as string, value: (v as number) * 1_000_000 }))} /></Card>
        <Card title="Recent activity" action={<button onClick={() => goto("audit")} className="text-[11px] font-extrabold text-brand-blue hover:underline">View all</button>}>{acts.map(([t, m], i) => <div key={i} className="flex gap-2.5 border-b border-border-soft py-2.5 last:border-0"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-[11px] font-bold text-brand-blue">●</span><div><strong className="block text-[11px]">{t}</strong><span className="text-[10px] text-ink-soft">{m}</span></div></div>)}</Card>
      </div>
    </>
  );
}

/* ---------- Students ---------- */
function Students({ students }: { students: Student[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [q, setQ] = useState("");
  const sample: Student[] = [
    { id: "s1", name: "Chiamaka Nwosu", admissionNo: "26-00001", createdAt: "JSS 2 · A" },
    { id: "s2", name: "Emeka Okafor", admissionNo: "26-00002", createdAt: "JSS 2 · B" },
    { id: "s3", name: "Daniel Adewale", admissionNo: "26-00003", createdAt: "SSS 1 · A" },
    { id: "s4", name: "Aisha Bello", admissionNo: "26-00004", createdAt: "SSS 1 · B" },
    { id: "s5", name: "Victor James", admissionNo: "26-00005", createdAt: "Primary 5 · A" },
  ];
  const rows = students.length ? students : sample;
  const clsOf = (r: Student) => (r.createdAt.includes("·") ? r.createdAt.split("·")[0].trim() : "—");
  const secOf = (r: Student) => (r.createdAt.includes("·") ? r.createdAt.split("·")[1].trim() : "—");
  const [classF, setClassF] = useState("all");
  const [sectionF, setSectionF] = useState("all");
  const classOpts = ["all", ...Array.from(new Set(rows.map(clsOf)))];
  const sectionOpts = ["all", ...Array.from(new Set(rows.map(secOf)))];
  const filtered = useMemo(() => rows.filter((r) => `${r.name} ${r.admissionNo}`.toLowerCase().includes(q.toLowerCase()) && (classF === "all" || clsOf(r) === classF) && (sectionF === "all" || secOf(r) === sectionF)), [rows, q, classF, sectionF]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Head title="Students" subtitle={`${(students.length || rows.length).toLocaleString()} students enrolled`} action={<PrimaryBtn onClick={() => setShowAdd((s) => !s)}>{I(<><path d="M12 5v14M5 12h14" /></>)}{showAdd ? "Close" : "Add student"}</PrimaryBtn>} />
      {showAdd && <div className="mb-[18px]"><Card title="Add a student"><div className="grid gap-[18px] sm:grid-cols-2"><AddStudentForm /><div className="border-t border-border-soft pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"><p className="mb-3 text-[12px] font-extrabold text-ink">Reset a student&rsquo;s password</p><ResetStudentPasswordForm /></div></div></Card></div>}
      <Card>
        <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-[10px] border border-border-soft bg-paper/60 px-3"><span className="text-ink-soft">{I(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>)}</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students…" className="min-h-9 flex-1 bg-transparent text-[13px] outline-none" /></div>
          <FilterSelect value={classF} onChange={setClassF} options={classOpts.map((c) => ({ v: c, label: c === "all" ? "All classes" : c }))} /><FilterSelect value={sectionF} onChange={setSectionF} options={sectionOpts.map((c) => ({ v: c, label: c === "all" ? "All sections" : c }))} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="w-8 py-2"><input type="checkbox" /></th><th className="py-2 font-bold">Student</th><th className="py-2 font-bold">Admission no.</th><th className="py-2 font-bold">Class</th><th className="py-2 font-bold">Section</th><th className="py-2 font-bold">Status</th><th className="py-2 text-right font-bold">Action</th></tr></thead>
            <tbody>{filtered.map((s) => { const [cls, sec] = (s.createdAt.includes("·") ? s.createdAt.split("·") : ["—", "—"]).map((x) => x.trim()); return (
              <tr key={s.id} className="border-b border-border-soft last:border-0 hover:bg-paper/60">
                <td className="py-2.5"><input type="checkbox" /></td>
                <td className="py-2.5"><div className="flex items-center gap-2.5"><Avatar name={s.name} size={28} /><span className="font-bold text-ink">{s.name}</span></div></td>
                <td className="py-2.5"><code className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand-blue">{s.admissionNo}</code></td>
                <td className="py-2.5 text-ink-soft">{cls}</td><td className="py-2.5 text-ink-soft">{sec}</td>
                <td className="py-2.5"><Pill>Active</Pill></td>
                <td className="py-2.5 text-right"><button className="rounded-md px-2 text-ink-soft hover:bg-paper">⋮</button></td>
              </tr>); })}</tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-[12px] text-ink-soft"><span>Showing 1 to {filtered.length} of {(students.length || rows.length).toLocaleString()}</span><div className="flex gap-1">{["‹", "1", "2", "3", "›"].map((p, i) => <button key={i} className={`grid size-7 place-items-center rounded-md border text-[11px] font-bold ${p === "1" ? "border-brand-blue bg-brand-blue text-white" : "border-border-soft text-ink-soft hover:bg-paper"}`}>{p}</button>)}</div></div>
      </Card>
    </>
  );
}

/* ---------- Staff ---------- */
const ROLE_LABEL: Record<string, string> = { school_admin: "Admin", principal: "Principal", vice_principal: "Vice principal", teacher: "Teacher", bursar: "Bursar" };
const SAMPLE_STAFF: Staff[] = [
  { name: "Grace Samuel", email: "grace.samuel@school.edu.ng", role: "teacher", teacherType: "Class teacher", subjects: ["English Language", "Literature"], assignedClass: "JSS 2A", status: "active", canApprove: false, permissions: { students: "edit", attendance: "edit", exams: "edit", results: "edit", reports: "view", messages: "edit", finance: "none", settings: "none" } },
  { name: "Emeka Okafor", email: "emeka.okafor@school.edu.ng", role: "teacher", teacherType: "Subject teacher", subjects: ["Physics", "Further Maths"], assignedClass: null, status: "active", canApprove: false, permissions: { students: "view", attendance: "none", exams: "edit", results: "edit", reports: "view", messages: "none", finance: "none", settings: "none" } },
  { name: "Peter Adewale", email: "peter.adewale@school.edu.ng", role: "principal", teacherType: "Principal", subjects: [], assignedClass: null, status: "active", canApprove: true, permissions: { students: "view", attendance: "view", exams: "view", results: "approve", reports: "view", messages: "edit", finance: "view", settings: "view" } },
  { name: "Ayoola Johnson", email: "ayoola.johnson@school.edu.ng", role: "bursar", teacherType: "Bursar", subjects: [], assignedClass: null, status: "pending", canApprove: false, permissions: { students: "view", attendance: "none", exams: "none", results: "none", reports: "view", messages: "none", finance: "edit", settings: "none" } },
];
const rank: Record<Level, number> = { none: 0, view: 1, edit: 2, approve: 3, full: 4 };

function StaffView({ staff }: { staff: Staff[] }) {
  const [inviting, setInviting] = useState(false);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [q, setQ] = useState("");
  const [roleF, setRoleF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const router = useRouter();
  const rows = staff.length ? staff : SAMPLE_STAFF;
  const filtered = rows.filter((r) => `${r.name} ${r.email} ${r.teacherType}`.toLowerCase().includes(q.toLowerCase()) && (roleF === "all" || r.role === roleF) && (statusF === "all" || r.status === statusF));
  const stats = [["Total staff", rows.length, "#2159e8", "#e7eefc"], ["Teachers", rows.filter((r) => r.role === "teacher").length, "#178a4c", "#e7f6ee"], ["Class teachers", rows.filter((r) => r.teacherType === "Class teacher").length, "#6b2fb3", "#f0e9fa"], ["Pending invites", rows.filter((r) => r.status === "pending").length, "#b9540f", "#fbeee3"]] as const;

  if (inviting) return <InviteWizard onClose={() => setInviting(false)} onDone={() => { setInviting(false); router.refresh(); }} />;

  return (
    <>
      <Head title="Staff management" subtitle="Assign roles, subjects, responsibilities and access for every staff member." action={<PrimaryBtn onClick={() => setInviting(true)}>{I(<><path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" /><circle cx="9" cy="7" r="3" /><path d="M19 8v6M22 11h-6" /></>)}Invite staff member</PrimaryBtn>} />
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, color, bg]) => <div key={label} className="rounded-2xl border border-border-soft bg-white p-[18px]"><div className="flex items-center justify-between"><div><small className="font-bold text-ink-soft">{label}</small><strong className="mt-2 block font-display text-[26px] font-semibold leading-none">{value}</strong></div><span className="grid size-9 place-items-center rounded-full" style={{ backgroundColor: bg, color }}>{I(ICONS.staff)}</span></div></div>)}
      </div>
      <Card className="mt-[18px]">
        <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center"><div className="flex flex-1 items-center gap-2 rounded-[10px] border border-border-soft bg-paper/60 px-3"><span className="text-ink-soft">{I(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>)}</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff by name, email or role…" className="min-h-9 flex-1 bg-transparent text-[13px] outline-none" /></div><FilterSelect value={roleF} onChange={setRoleF} options={[{ v: "all", label: "All roles" }, { v: "teacher", label: "Teacher" }, { v: "principal", label: "Principal" }, { v: "vice_principal", label: "Vice principal" }, { v: "bursar", label: "Bursar" }]} /><FilterSelect value={statusF} onChange={setStatusF} options={[{ v: "all", label: "All statuses" }, { v: "active", label: "Active" }, { v: "pending", label: "Pending" }]} /></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[12px]">
          <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="py-2 font-bold">Staff member</th><th className="py-2 font-bold">Role</th><th className="py-2 font-bold">Teacher type</th><th className="py-2 font-bold">Subjects</th><th className="py-2 font-bold">Class</th><th className="py-2 font-bold">Status</th><th className="py-2 font-bold"></th></tr></thead>
          <tbody>{filtered.map((s, i) => <tr key={i} onClick={() => setSelected(s)} className="cursor-pointer border-b border-border-soft last:border-0 hover:bg-paper/60">
            <td className="py-2.5"><div className="flex items-center gap-2.5"><Avatar name={s.name} size={30} /><div><div className="font-bold text-ink">{s.name}</div><div className="text-[10px] text-ink-soft">{s.email}</div></div></div></td>
            <td className="py-2.5"><span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-extrabold text-brand-blue">{ROLE_LABEL[s.role] ?? s.role}</span></td>
            <td className="py-2.5 text-ink-soft">{s.teacherType}</td>
            <td className="py-2.5">{s.subjects.length ? <div className="flex flex-wrap gap-1">{s.subjects.slice(0, 2).map((x) => <span key={x} className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">{x}</span>)}{s.subjects.length > 2 && <span className="text-[10px] text-ink-soft">+{s.subjects.length - 2}</span>}</div> : <span className="text-ink-soft">—</span>}</td>
            <td className="py-2.5 text-ink-soft">{s.assignedClass ?? "—"}</td>
            <td className="py-2.5"><Pill color={s.status === "pending" ? "blue" : "green"}>{s.status === "pending" ? "Pending" : "Active"}</Pill></td>
            <td className="py-2.5 text-right text-ink-soft">›</td>
          </tr>)}</tbody>
        </table></div>
      </Card>

      {selected && <div className="fixed inset-0 z-50"><div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} /><aside className="absolute right-0 top-0 h-full w-[min(440px,100%)] overflow-y-auto bg-white p-6 shadow-[0_0_60px_rgba(16,33,63,.2)] motion-safe:animate-[fade-up_.2s_ease]">
        <div className="mb-5 flex items-center justify-between"><h2 className="font-display text-[20px] font-semibold">Staff details</h2><button onClick={() => setSelected(null)} className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-paper">✕</button></div>
        <div className="flex items-center gap-3.5"><Avatar name={selected.name} size={56} /><div><div className="font-display text-[17px] font-semibold">{selected.name}</div><div className="text-[12px] text-ink-soft">{selected.email}</div><div className="mt-0.5"><Pill color={selected.status === "pending" ? "blue" : "green"}>{selected.status === "pending" ? "Pending" : "Active"}</Pill></div></div></div>
        <dl className="mt-5 grid gap-0">{[["Role", ROLE_LABEL[selected.role] ?? selected.role], ["Type", selected.teacherType], ["Assigned class", selected.assignedClass ?? "—"], ["Subjects", selected.subjects.join(", ") || "—"], ["Approve payments", selected.canApprove ? "Yes" : "No"]].map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-border-soft py-2.5 last:border-0"><dt className="text-[12px] font-bold text-ink-soft">{k}</dt><dd className="max-w-[60%] text-right text-[12px] font-bold text-ink">{v}</dd></div>)}</dl>
        <h3 className="mb-2 mt-6 font-display text-[15px] font-semibold">Permissions</h3>
        <div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><thead><tr className="text-[9px] uppercase tracking-wide text-ink-soft"><th className="py-1.5">Area</th>{LEVELS.map((l) => <th key={l.key} className="py-1.5 text-center font-bold">{l.label}</th>)}</tr></thead><tbody>{AREAS.map((a) => { const lvl = (selected.permissions[a] ?? "none") as Level; return <tr key={a} className="border-t border-border-soft"><td className="py-2 font-bold text-ink">{AREA_LABELS[a]}</td>{LEVELS.map((l) => <td key={l.key} className="py-2 text-center">{lvl !== "none" && rank[lvl] >= rank[l.key] ? <span className="text-brand-green">✓</span> : <span className="text-[#cdd7e6]">—</span>}</td>)}</tr>; })}</tbody></table></div>
        <p className="mt-4 rounded-lg bg-brand-soft/60 p-2.5 text-[10px] leading-relaxed text-ink-soft">Permissions are suggested from the role and responsibilities, then adjusted if needed.</p>
      </aside></div>}
    </>
  );
}

/* ---------- Profile ---------- */
function Profile({ school, logo, onLogo, goto }: { school: School; logo: string | null; onLogo: (v: string | null) => void; goto: (s: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  async function upload(file: File) {
    setBusy(true); setMsg(null);
    const fd = new FormData(); fd.append("logo", file);
    const r = await uploadSchoolLogo(fd);
    setBusy(false);
    if ("error" in r) { setMsg(r.error); return; }
    onLogo(`${r.logoUrl}?t=${Date.now()}`);
  }
  async function remove() { setBusy(true); await removeSchoolLogo(); setBusy(false); onLogo(null); }
  const rows: [string, string][] = [["School name", school.name], ["School code", school.schoolCode], ["Email", school.email ?? "—"], ["Phone", school.phone ?? "—"], ["Address", school.address ?? "—"]];
  return (
    <>
      <Head title="School profile" subtitle="Your school's identity and details." />
      <div className="grid gap-[18px] lg:grid-cols-[300px_1fr]">
        <Card title="School logo">
          <div className="grid place-items-center gap-4 py-2">
            <div className="grid size-32 place-items-center overflow-hidden rounded-2xl border border-border-soft bg-paper">{logo ? <img src={logo} alt="School logo" className="size-full object-cover" /> : <span className="font-display text-[40px] font-bold text-brand-blue">{school.name.slice(0, 1)}</span>}</div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            <div className="flex gap-2"><button disabled={busy} onClick={() => fileRef.current?.click()} className="inline-flex min-h-9 items-center rounded-[10px] bg-brand-blue px-3.5 text-[12px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-70">{busy ? "Working…" : "Change logo"}</button>{logo && <button disabled={busy} onClick={remove} className="inline-flex min-h-9 items-center rounded-[10px] border border-[#f3c2c2] bg-[#fdeeee] px-3.5 text-[12px] font-extrabold text-[#b3261e] transition hover:bg-[#fbe3e3]">Remove</button>}</div>
            {msg && <p className="text-[11px] font-bold text-[#b3261e]">{msg}</p>}
            <p className="text-[10px] text-ink-soft">PNG or JPG, max 2MB.</p>
          </div>
        </Card>
        <Card title="School details" action={<button onClick={() => goto("settings")} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border-soft px-3 py-1.5 text-[12px] font-extrabold text-brand-blue transition hover:bg-brand-soft">{I(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>)}Edit</button>}>
          <dl className="grid gap-0">{rows.map(([k, v]) => <div key={k} className="flex items-start justify-between gap-4 border-b border-border-soft py-3 last:border-0"><dt className="text-[12px] font-bold text-ink-soft">{k}</dt><dd className="max-w-[60%] text-right text-[13px] font-bold text-ink">{v}</dd></div>)}</dl>
        </Card>
      </div>
    </>
  );
}

/* ---------- Settings ---------- */
function Settings({ school, onSaved }: { school: School; onSaved: (s: School) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = { name: String(fd.get("name") || ""), email: String(fd.get("email") || ""), phone: String(fd.get("phone") || ""), state: String(fd.get("state") || ""), country: String(fd.get("country") || ""), address: String(fd.get("address") || "") };
    setBusy(true); setMsg(null);
    const r = await updateSchoolProfile(input);
    setBusy(false); setMsg(r);
    if ("ok" in r) onSaved({ ...school, ...input });
  }
  return (
    <>
      <Head title="Settings" subtitle="Update your school information." />
      <Card className="max-w-[680px]">
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field label="School name" name="name" defaultValue={school.name} />
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Contact email" name="email" type="email" defaultValue={school.email ?? ""} placeholder="admin@school.edu.ng" /><Field label="Phone" name="phone" defaultValue={school.phone ?? ""} placeholder="+234 800 000 0000" /></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="State" name="state" defaultValue={school.state ?? ""} /><Field label="Country" name="country" defaultValue={school.country ?? ""} /></div>
          <Field label="Address" name="address" defaultValue={school.address ?? ""} />
          <div className="flex items-center gap-3"><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-brand-blue px-5 text-[13px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark disabled:opacity-70">{busy ? "Saving…" : "Save changes"}</button>{msg?.ok && <span className="text-[12px] font-bold text-brand-green">Saved ✓</span>}{msg?.error && <span className="text-[12px] font-bold text-[#b3261e]">{msg.error}</span>}</div>
        </form>
      </Card>
    </>
  );
}

/* ---------- Audit log ---------- */
function AuditLog({ audit }: { audit: Audit[] }) {
  const rows = audit.length ? audit : [
    { action: "school.created", entityType: "School", actor: "George L.", at: "Just now" },
    { action: "student.added", entityType: "Student", actor: "George L.", at: "10 min ago" },
    { action: "staff.invited", entityType: "Staff", actor: "George L.", at: "30 min ago" },
    { action: "fees.published", entityType: "Finance", actor: "George L.", at: "1 hr ago" },
    { action: "settings.updated", entityType: "Settings", actor: "George L.", at: "2 hrs ago" },
  ];
  return (
    <>
      <Head title="Audit log" subtitle="A record of important actions in your school." />
      <Card>
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-[12px]"><thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="py-2 font-bold">Action</th><th className="py-2 font-bold">Entity</th><th className="py-2 font-bold">Actor</th><th className="py-2 font-bold">When</th></tr></thead><tbody>{rows.map((a, i) => <tr key={i} className="border-b border-border-soft last:border-0 hover:bg-paper/60"><td className="py-2.5"><code className="font-bold text-brand-blue">{a.action}</code></td><td className="py-2.5 text-ink-soft">{a.entityType}</td><td className="py-2.5 font-bold text-ink">{a.actor ?? "system"}</td><td className="py-2.5 text-ink-soft">{a.at}</td></tr>)}</tbody></table></div>
        <button className="mt-4 rounded-[10px] border border-border-soft px-4 py-2 text-[12px] font-extrabold text-brand-blue transition hover:bg-brand-soft">View all logs</button>
      </Card>
    </>
  );
}

/* ---------- Coming soon placeholder ---------- */
function ComingSoon({ name }: { name: string }) {
  return <><Head title={name} subtitle={`The ${name} module is coming soon.`} /><div className="grid place-items-center rounded-2xl border border-dashed border-border-soft bg-white py-20 text-center"><div className="mb-3 grid size-12 place-items-center rounded-xl bg-brand-soft text-brand-blue">{I(ICONS[name.toLowerCase()] ?? ICONS.reports)}</div><h2 className="font-display text-[18px] font-semibold">{name} is on the way</h2><p className="mt-1 max-w-sm text-[13px] text-ink-soft">We&rsquo;re building this module. You&rsquo;ll manage {name.toLowerCase()} right here soon.</p></div></>;
}
