"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/client";
import { AddStudentForm, ResetStudentPasswordForm } from "./people-forms";
import { BarChart, DonutChart } from "./charts";
import { InviteWizard } from "./invite-wizard";
import { FinanceView } from "./finance-view";
import { ClassFinanceView } from "./class-finance";
import { StudentProfilePage } from "./student-profile";
import { EmptyArt } from "./illustration";
import { CalendarCard } from "./calendar";
import { StudentCredentials } from "./credentials";
import { ClassManager } from "./class-manager";
import { StaffClockInView } from "./attendance-view";
import { StudentAttendanceView } from "./student-attendance-view";
import { updateSchoolProfile, uploadSchoolLogo, removeSchoolLogo } from "@/lib/actions/school";
import { setStaffStatus, removeStaff } from "@/lib/actions/people";
import { AREAS, AREA_LABELS, LEVELS, type Level } from "@/lib/permissions";
import type { AdminOverview } from "@/lib/dashboard";

export type School = { name: string; schoolCode: string; email: string | null; phone: string | null; state: string | null; country: string | null; address: string | null; logoKey: string | null; requireApproval: boolean; currentSession: string; currentTerm: string; dayStartsAt: string | null; dayEndsAt: string | null };
type Student = { id: string; name: string; admissionNo: string; createdAt: string; className?: string | null };
export type Staff = { userId: string; name: string; email: string | null; staffNo: string | null; role: string; teacherType: string; subjects: string[]; assignedClass: string | null; status: string; canApprove: boolean; permissions: Record<string, string> };
type Audit = { action: string; entityType: string; entityId?: string | null; actor: string | null; actorRole?: string | null; ts: number; detail: string; meta?: Record<string, unknown> };

// Maps an event to where it can be acted on, so notifications/activity are click-through.
function navTarget(a: Audit): { section: string; studentId?: string } {
  const x = a.action;
  if (x.startsWith("payment.") || x.startsWith("fees.") || x.startsWith("refund.") || x.startsWith("credit.")) return { section: "finance" };
  if (x.startsWith("staff.")) return { section: "staff" };
  if (x.startsWith("attendance.")) return { section: "attendance" };
  if (x === "settings.updated") return { section: "settings" };
  if (x.startsWith("event.")) return { section: "overview" };
  if (x === "student.updated" || x === "result.recorded") return { section: "students", studentId: a.entityId ?? undefined };
  if (x.startsWith("student.")) return { section: "students" };
  return { section: "audit" };
}

const ACTION_LABEL: Record<string, string> = { "school.created": "School created", "student.added": "Student added", "staff.invited": "Staff invited", "staff.joined": "Staff joined", "payment.recorded": "Payment recorded", "payment.approved": "Payment approved", "payment.rejected": "Payment rejected", "fees.issued": "Fees issued", "settings.updated": "Settings updated" };
const actLabel = (a: string) => ACTION_LABEL[a] ?? a.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
function relTime(ts: number) { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return "just now"; const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`; const h = Math.floor(m / 60); if (h < 24) return `${h} hr ago`; const d = Math.floor(h / 24); if (d < 7) return `${d} day${d > 1 ? "s" : ""} ago`; return new Date(ts).toLocaleDateString(); }
type Props = { userName: string; school: School; students: Student[]; staff: Staff[]; audit: Audit[]; overview: AdminOverview; initialSection?: string };

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
const NAV: [string, string, number?][] = [["overview", "Overview"], ["students", "Students"], ["staff", "Staff"], ["attendance", "Attendance"], ["finance", "Finance"], ["messages", "Messages", 3], ["reports", "Reports"], ["settings", "Settings"], ["audit", "Audit log"]];

function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }
const AV_COLORS = ["#2159e8", "#178a4c", "#b9540f", "#6b2fb3", "#0d8aa8"];
function Avatar({ name, size = 30 }: { name: string; size?: number }) { const c = AV_COLORS[name.length % AV_COLORS.length]; return <span className="grid shrink-0 place-items-center rounded-full font-extrabold text-white" style={{ width: size, height: size, backgroundColor: c, fontSize: size * 0.36 }}>{initials(name)}</span>; }

export function AdminApp({ userName, school, students, staff, audit, overview, initialSection = "overview" }: Props) {
  const [active, setActive] = useState(initialSection);
  const [open, setOpen] = useState(false);
  const [logo, setLogo] = useState<string | null>(school.logoKey);
  const [details, setDetails] = useState(school);
  const [notifOpen, setNotifOpen] = useState(false);
  const [deepStudent, setDeepStudent] = useState<string | null>(null);
  const router = useRouter();
  async function logout() { await signOut(); router.push("/login"); }
  // Single navigation entry point so notifications/activity can jump to a section (and optionally a student).
  function navigate(section: string, studentId?: string) { if (studentId) setDeepStudent(studentId); setActive(section); setOpen(false); }
  function onNotif(a: Audit) { const t = navTarget(a); navigate(t.section, t.studentId); }

  const sidebar = (
    <>
      <div className="flex items-center gap-2.5 px-1 font-display text-[21px] font-semibold text-white">
        {logo ? <img src={logo} alt="" className="size-7 rounded-md object-cover" /> : <span className="grid size-6 rotate-45 place-items-center border-2 border-brand-green"><i className="size-[7px] border-2 border-brand-green" /></span>}Edumod
      </div>
      <div className="my-[16px] rounded-[10px] border border-white/15 p-3 text-[11px] text-[#eef4ff]"><strong className="line-clamp-1">{details.name}</strong>{details.currentSession} · {details.currentTerm}<div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2"><span className="text-[#9fb6d8]">School code</span><code className="select-all font-extrabold tracking-wide text-white">{school.schoolCode}</code></div></div>
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
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} /><aside className="absolute left-0 top-0 flex h-full w-[min(260px,85vw)] flex-col overflow-y-auto bg-ink px-4 py-[20px] motion-safe:animate-[fade-up_.2s_ease]">{sidebar}</aside></div>}

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border-soft bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid size-10 place-items-center rounded-[10px] border border-border-soft">{I(<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>)}</button>
          <span className="font-display text-[18px] font-semibold">{NAV.find((n) => n[0] === active)?.[1]}</span>
          <NotifBell open={notifOpen} setOpen={setNotifOpen} audit={audit} onViewAll={() => setActive("audit")} onNavigate={onNotif} />
        </header>

        <main className="overflow-x-hidden p-4 sm:p-6 lg:px-7 lg:py-6">
          {active === "overview" && <Overview userName={userName} school={details} students={students} staff={staff} audit={audit} overview={overview} notifOpen={notifOpen} setNotifOpen={setNotifOpen} goto={navigate} onNotif={onNotif} />}
          {active === "students" && <Students students={students} openStudentId={deepStudent} onConsumed={() => setDeepStudent(null)} />}
          {active === "staff" && <StaffView staff={staff} />}
          {active === "settings" && <Settings school={details} logo={logo} onLogo={setLogo} onSaved={setDetails} />}
          {active === "audit" && <AuditLog audit={audit} />}
          {active === "finance" && <FinanceArea />}
          {active === "attendance" && <StudentAttendanceView />}
          {["messages", "reports"].includes(active) && <ComingSoon name={NAV.find((n) => n[0] === active)![1]} />}
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
function Empty({ text }: { text: string }) { return <div className="grid place-items-center rounded-xl border border-dashed border-border-soft py-8 text-center text-[12px] text-ink-soft motion-safe:animate-[pop-in_.4s_ease]"><EmptyArt className="mb-1 size-24" />{text}</div>; }
const Pill = ({ children, color = "green" }: { children: React.ReactNode; color?: "green" | "blue" }) => <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${color === "green" ? "bg-brand-green/10 text-brand-green" : "bg-brand-soft text-brand-blue"}`}><span className={`size-1.5 rounded-full ${color === "green" ? "bg-brand-green" : "bg-brand-blue"}`} />{children}</span>;

const NOTIF_KEY = "edumod:notifLastRead";
function NotifBell({ open, setOpen, audit, onViewAll, onNavigate }: { open: boolean; setOpen: (v: boolean) => void; audit: Audit[]; onViewAll: () => void; onNavigate: (a: Audit) => void }) {
  // Notifications are the most recent real audit events; "read" state persists per browser.
  const [lastRead, setLastRead] = useState(0);
  const [baseline, setBaseline] = useState(0); // highlights items that were unread when the panel was opened
  useEffect(() => { setLastRead(Number(localStorage.getItem(NOTIF_KEY) || 0)); }, []);
  const items = audit.slice(0, 8);
  const unread = items.filter((a) => a.ts > lastRead).length;
  const newest = items.reduce((m, a) => Math.max(m, a.ts), lastRead);
  function clearBadge() { localStorage.setItem(NOTIF_KEY, String(newest)); setLastRead(newest); }
  function toggle() { if (!open) { setBaseline(lastRead); clearBadge(); } setOpen(!open); } // opening clears the unread count
  function markRead() { setBaseline(newest); clearBadge(); }
  return (
    <div className="relative">
      <button onClick={toggle} aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full border border-border-soft bg-white text-ink-soft transition hover:text-brand-blue">{I(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>)}{unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-brand-green text-[8px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}</button>
      {open && <><div className="fixed inset-0 z-40" onClick={() => setOpen(false)} /><div className="absolute right-0 top-12 z-50 w-[min(320px,calc(100vw-32px))] rounded-2xl border border-border-soft bg-white p-2 shadow-[0_20px_50px_rgba(16,33,63,.16)] motion-safe:animate-[fade-up_.2s_ease]"><div className="flex items-center justify-between px-2 py-1.5"><strong className="text-[13px]">Notifications</strong>{items.length > 0 && <button onClick={markRead} className="text-[11px] font-bold text-brand-blue hover:underline">Mark all as read</button>}</div>
        {items.length === 0 ? <p className="px-2 py-6 text-center text-[12px] text-ink-soft">You&rsquo;re all caught up.</p> : items.map((a, i) => { const isNew = a.ts > baseline; return <button key={i} onClick={() => { markRead(); onNavigate(a); }} className={`flex w-full gap-2.5 rounded-xl px-2 py-2 text-left transition ${isNew ? "bg-brand-soft/40 hover:bg-brand-soft/60" : "hover:bg-paper/70"}`}><span className="relative grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-[12px] font-bold text-brand-blue">●{isNew && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-brand-green ring-2 ring-white" />}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><strong className="truncate text-[11px]">{a.detail || actLabel(a.action)}</strong><span className="shrink-0 text-[10px] text-ink-soft">{relTime(a.ts)}</span></div><p className="text-[10px] leading-snug text-ink-soft">{actLabel(a.action)} · {a.actor ?? "system"} · <span className="font-bold text-brand-blue">open ↗</span></p></div></button>; })}
        <button onClick={() => { setOpen(false); onViewAll(); }} className="mt-1 w-full rounded-xl py-2 text-center text-[12px] font-extrabold text-brand-blue hover:bg-brand-soft">View all in audit log →</button></div></>}
    </div>
  );
}

/* ---------- Finance area (Payments dashboard + Class summary) ---------- */
function FinanceArea() {
  const [view, setView] = useState<"payments" | "classes">("payments");
  return (
    <>
      <div className="mb-4 inline-flex rounded-[12px] border border-border-soft bg-white p-1">
        {([["payments", "Payments & approvals"], ["classes", "Class summary"]] as const).map(([k, label]) => <button key={k} onClick={() => setView(k)} className={`rounded-[9px] px-3.5 py-1.5 text-[12px] font-extrabold transition ${view === k ? "bg-brand-blue text-white" : "text-ink-soft hover:text-brand-blue"}`}>{label}</button>)}
      </div>
      {view === "payments" ? <FinanceView /> : <ClassFinanceView />}
    </>
  );
}

/* ---------- Overview ---------- */
const naira = (n: number) => `₦${n.toLocaleString()}`;
const compactN = (n: number) => (n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M` : n >= 1000 ? `₦${(n / 1000).toFixed(0)}k` : `₦${n}`);
function Overview({ userName, school, students, staff, audit, overview, notifOpen, setNotifOpen, goto, onNotif }: { userName: string; school: School; students: Student[]; staff: Staff[]; audit: Audit[]; overview: AdminOverview; notifOpen: boolean; setNotifOpen: (v: boolean) => void; goto: (s: string, studentId?: string) => void; onNotif: (a: Audit) => void }) {
  const totalStudents = students.length;
  const teachers = staff.filter((s) => s.teacherType.includes("teacher") || s.role === "teacher").length || staff.length;
  const { jss, sss, primary, other } = overview.sections;
  const stats = [
    ["Total students", totalStudents.toLocaleString(), totalStudents ? "Enrolled" : "Add your first student", "#178a4c", "#e7f6ee", ICONS.students, "students"],
    ["Teaching staff", String(staff.length), `${teachers} teaching`, "#6b2fb3", "#f0e9fa", ICONS.staff, "staff"],
    ["Fees collected", compactN(overview.collected), "Approved payments", "#178a4c", "#e7f6ee", ICONS.finance, "finance"],
    ["Outstanding", compactN(overview.outstanding), "Across all invoices", "#b9540f", "#fbeee3", ICONS.finance, "finance"],
  ] as const;
  const hasSeries = overview.series.some((p) => p.value > 0);
  const segments = [
    { label: "Primary", value: primary, color: "#b9540f" },
    { label: "JSS", value: jss, color: "#2159e8" },
    { label: "SSS", value: sss, color: "#178a4c" },
    ...(other ? [{ label: "Other", value: other, color: "#6b2fb3" }] : []),
  ].filter((s) => s.value > 0);
  return (
    <>
      <Head title={`Good morning, ${userName.split(" ")[0]} 👋`} subtitle={`${school.currentTerm} · ${school.currentSession} session · here's what's happening today.`} action={<div className="flex items-center gap-2.5"><div className="hidden sm:block"><NotifBell open={notifOpen} setOpen={setNotifOpen} audit={audit} onViewAll={() => goto("audit")} onNavigate={onNotif} /></div><button onClick={() => goto("settings")} title="Change session / term in Settings" className="inline-flex items-center gap-1.5 rounded-[9px] border border-border-soft bg-white px-3 py-1.5 text-[12px] font-bold text-ink-soft transition hover:border-brand-blue hover:text-brand-blue">{school.currentSession} · {school.currentTerm}{I(<path d="m6 9 6 6 6-6" />)}</button></div>} />

      {/* Mobile: calendar sits under the greeting, before the stat cards. On desktop it lives in the right rail. */}
      <div className="mb-[18px] xl:hidden"><CalendarCard canManage /></div>

      <div className="grid gap-[18px] xl:grid-cols-[1fr_300px]">
        {/* Main column */}
        <div className="min-w-0">
          <div className="grid gap-3.5 grid-cols-2 lg:grid-cols-4">
            {stats.map(([label, value, meta, color, bg, icon, target]) => (
              <button key={label} onClick={() => goto(target)} className="rounded-2xl border border-border-soft bg-white p-[16px] text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(16,33,63,.08)]">
                <span className="grid size-9 place-items-center rounded-full" style={{ backgroundColor: bg, color }}>{I(icon)}</span>
                <strong className="mt-2.5 block break-words font-display text-[clamp(18px,4.5vw,24px)] font-semibold leading-none">{value}</strong>
                <small className="mt-1.5 block font-bold text-ink-soft">{label}</small>
                <span className="mt-1 inline-block text-[10px] font-extrabold text-ink-soft">{meta}</span>
              </button>
            ))}
          </div>

          <div className="mt-[18px] grid gap-[18px] lg:grid-cols-[1.4fr_1fr]">
            <Card title="Fee collection (last 6 months)">
              {hasSeries ? <BarChart yMax={Math.max(...overview.series.map((p) => p.value)) * 1.2 || 1000} yLabel={(n) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(0)}M` : `${Math.round(n / 1000)}k`)} data={overview.series} />
                : <Empty text="No approved payments yet. Collections chart here as payments are approved." />}
            </Card>
            <Card title="Students by section" action={<button onClick={() => goto("students")} className="text-[11px] font-extrabold text-brand-blue hover:underline">View</button>}>
              {segments.length ? <DonutChart total={totalStudents} segments={segments} /> : <Empty text="Assign classes to students to see the breakdown." />}
            </Card>
          </div>

          <div className="mt-[18px]">
            <Card title="Recent activity" action={<button onClick={() => goto("audit")} className="text-[11px] font-extrabold text-brand-blue hover:underline">View all</button>}>
              {audit.length === 0 ? <Empty text="No activity yet. Actions in your school will appear here." /> : audit.slice(0, 6).map((a, i) => <button key={i} onClick={() => onNotif(a)} className="flex w-full gap-2.5 border-b border-border-soft py-2.5 text-left last:border-0 hover:bg-paper/50"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-[11px] font-bold text-brand-blue">●</span><div className="min-w-0 flex-1"><strong className="block text-[11px]">{a.detail || actLabel(a.action)}</strong><span className="text-[10px] text-ink-soft">{actLabel(a.action)} · by {a.actor ?? "system"} · {relTime(a.ts)}</span></div><span className="shrink-0 self-center text-[11px] font-extrabold text-brand-blue">↗</span></button>)}
            </Card>
          </div>
        </div>

        {/* Right rail (calendar hidden on mobile — it's shown under the greeting instead) */}
        <div className="grid content-start gap-[18px]">
          <div className="hidden xl:block"><CalendarCard canManage /></div>
          <Card title="Classes" action={<button onClick={() => goto("students")} className="text-[11px] font-extrabold text-brand-blue hover:underline">All</button>}>
            {overview.classList.length === 0 ? <p className="text-[12px] text-ink-soft">No classes yet. Add students with a class.</p> : <ul className="grid gap-1.5">{overview.classList.slice(0, 6).map((c) => <li key={c.className} className="flex items-center justify-between rounded-xl border border-border-soft px-3 py-2 text-[12px]"><span className="font-bold text-ink">{c.className}</span><span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-extrabold text-brand-blue">{c.count}</span></li>)}</ul>}
          </Card>
          <Card title="Top performers" action={<button onClick={() => goto("students")} className="text-[11px] font-extrabold text-brand-blue hover:underline">All</button>}>
            {overview.topPerformers.length === 0 ? <p className="text-[12px] text-ink-soft">Record results to see top performers.</p> : <ol className="grid gap-1.5">{overview.topPerformers.map((p, i) => <li key={i} className="flex items-center gap-2.5 text-[12px]"><span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-extrabold ${i === 0 ? "bg-[#f4b740] text-white" : "bg-brand-soft text-brand-blue"}`}>{i + 1}</span><div className="min-w-0 flex-1"><div className="truncate font-bold text-ink">{p.name}</div><div className="text-[10px] text-ink-soft">{p.className ?? "—"}</div></div><span className="font-extrabold text-brand-green">{p.average}%</span></li>)}</ol>}
          </Card>
        </div>
      </div>
    </>
  );
}

/* ---------- Students ---------- */
function Students({ students, openStudentId, onConsumed }: { students: Student[]; openStudentId?: string | null; onConsumed?: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showLogins, setShowLogins] = useState(false);
  const [showClasses, setShowClasses] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();
  // Deep-link from a notification (e.g. "result saved for …") opens that student's profile.
  useEffect(() => { if (openStudentId) { setSelected(openStudentId); onConsumed?.(); } }, [openStudentId]); // eslint-disable-line react-hooks/exhaustive-deps
  const clsOf = (r: Student) => r.className || (r.createdAt.includes("·") ? r.createdAt.split("·")[0].trim() : "—");
  const [classF, setClassF] = useState("all");
  const [page, setPage] = useState(1);
  const per = 10;
  const classOpts = ["all", ...Array.from(new Set(students.map(clsOf))).filter((c) => c !== "—")];
  const filtered = useMemo(() => students.filter((r) => `${r.name} ${r.admissionNo}`.toLowerCase().includes(q.toLowerCase()) && (classF === "all" || clsOf(r) === classF)), [students, q, classF]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(filtered.length / per));
  const cur = Math.min(page, pages);
  const slice = filtered.slice((cur - 1) * per, cur * per);
  if (selected) return <StudentProfilePage studentId={selected} onBack={() => setSelected(null)} onChanged={() => router.refresh()} />;
  return (
    <>
      <Head title="Students" subtitle={`${students.length.toLocaleString()} student${students.length === 1 ? "" : "s"} enrolled`} action={<div className="flex flex-wrap gap-2"><button onClick={() => { setShowClasses((s) => !s); setShowAdd(false); setShowLogins(false); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-border-soft bg-white px-3.5 text-[13px] font-extrabold text-ink-soft transition hover:border-brand-blue hover:text-brand-blue">🏫 {showClasses ? "Close" : "Classes"}</button><button onClick={() => { setShowLogins((s) => !s); setShowAdd(false); setShowClasses(false); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-border-soft bg-white px-3.5 text-[13px] font-extrabold text-ink-soft transition hover:border-brand-blue hover:text-brand-blue">🔑 {showLogins ? "Close" : "Logins"}</button><PrimaryBtn onClick={() => { setShowAdd((s) => !s); setShowLogins(false); setShowClasses(false); }}>{showAdd ? I(<><path d="M18 6 6 18M6 6l12 12" /></>) : I(<><path d="M12 5v14M5 12h14" /></>)}{showAdd ? "Close" : "Add student"}</PrimaryBtn></div>} />
      {showClasses && <div className="mb-[18px]"><ClassManager /></div>}
      {showAdd && <div className="mb-[18px]"><Card title="Add a student"><div className="grid gap-[18px] sm:grid-cols-2"><AddStudentForm /><div className="border-t border-border-soft pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"><p className="mb-3 text-[12px] font-extrabold text-ink">Reset a student&rsquo;s password</p><ResetStudentPasswordForm /></div></div></Card></div>}
      {showLogins && <div className="mb-[18px]"><Card title="Student logins"><StudentCredentials students={students} /></Card></div>}
      <Card>
        <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-[10px] border border-border-soft bg-paper/60 px-3"><span className="text-ink-soft">{I(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>)}</span><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search students…" className="min-h-9 flex-1 bg-transparent text-[13px] outline-none" /></div>
          <FilterSelect value={classF} onChange={(v) => { setClassF(v); setPage(1); }} options={classOpts.map((c) => ({ v: c, label: c === "all" ? "All classes" : c }))} />
        </div>
        {filtered.length === 0 ? <Empty text={students.length === 0 ? "No students yet. Click “Add student” to enrol your first." : "No students match your search."} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-left text-[12px]">
              <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="py-2 font-bold">Student</th><th className="py-2 font-bold">Admission no.</th><th className="py-2 font-bold">Class</th><th className="py-2 font-bold">Status</th></tr></thead>
              <tbody>{slice.map((s) => (
                <tr key={s.id} onClick={() => setSelected(s.id)} className="cursor-pointer border-b border-border-soft last:border-0 hover:bg-paper/60">
                  <td className="py-2.5"><div className="flex items-center gap-2.5"><Avatar name={s.name} size={28} /><span className="font-bold text-ink">{s.name}</span></div></td>
                  <td className="py-2.5"><code className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand-blue">{s.admissionNo}</code></td>
                  <td className="py-2.5 text-ink-soft">{clsOf(s)}</td>
                  <td className="py-2.5"><div className="flex items-center justify-between gap-2"><Pill>Active</Pill><span className="text-ink-soft">›</span></div></td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && <div className="mt-4 flex flex-col items-center justify-between gap-2 text-[12px] text-ink-soft sm:flex-row"><span>Showing {(cur - 1) * per + 1} to {Math.min(cur * per, filtered.length)} of {filtered.length}</span><div className="flex gap-1"><PageBtn disabled={cur === 1} onClick={() => setPage(cur - 1)}>‹</PageBtn>{Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, cur - 2), Math.max(0, cur - 2) + 4).map((n) => <PageBtn key={n} active={n === cur} onClick={() => setPage(n)}>{String(n)}</PageBtn>)}<PageBtn disabled={cur === pages} onClick={() => setPage(cur + 1)}>›</PageBtn></div></div>}
      </Card>
    </>
  );
}
function PageBtn({ children, active, disabled, onClick }: { children: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button onClick={onClick} disabled={disabled} className={`grid size-7 place-items-center rounded-md border text-[11px] font-bold transition disabled:opacity-40 ${active ? "border-brand-blue bg-brand-blue text-white" : "border-border-soft text-ink-soft hover:bg-paper"}`}>{children}</button>;
}

/* ---------- Staff ---------- */
const ROLE_LABEL: Record<string, string> = { school_admin: "Admin", principal: "Principal", vice_principal: "Vice principal", teacher: "Teacher", bursar: "Bursar" };
const rank: Record<Level, number> = { none: 0, view: 1, edit: 2, approve: 3, full: 4 };
function StaffStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = { active: ["Active", "bg-brand-green/10 text-brand-green"], pending: ["Pending", "bg-brand-soft text-brand-blue"], inactive: ["Inactive", "bg-paper text-ink-soft"], left: ["Left school", "bg-[#fdeeee] text-[#b3261e]"] };
  const [label, cls] = map[status] ?? map.active;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold ${cls}`}>{label}</span>;
}
function StaffActions({ staff, onDone, onErr }: { staff: Staff; onDone: () => void; onErr: (e: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function set(status: "active" | "inactive" | "left") { setBusy(true); onErr(""); const r = await setStaffStatus(staff.userId, status); setBusy(false); if ("error" in r) onErr(r.error); else onDone(); }
  async function remove() { if (!confirm(`Remove ${staff.name}? This permanently deletes their account.`)) return; setBusy(true); onErr(""); const r = await removeStaff(staff.userId); setBusy(false); if ("error" in r) onErr(r.error); else onDone(); }
  const btn = "inline-flex min-h-9 items-center rounded-[9px] border px-3 text-[12px] font-extrabold transition disabled:opacity-60";
  return (
    <div className="mt-5 rounded-xl border border-border-soft p-3">
      <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">Manage staff</div>
      <div className="flex flex-wrap gap-2">
        {staff.status !== "active" && <button onClick={() => set("active")} disabled={busy} className={`${btn} border-brand-green/30 bg-brand-green/10 text-brand-green hover:bg-brand-green/20`}>Set active</button>}
        {staff.status !== "inactive" && <button onClick={() => set("inactive")} disabled={busy} className={`${btn} border-border-soft bg-white text-ink-soft hover:border-brand-blue`}>Set inactive</button>}
        {staff.status !== "left" && <button onClick={() => set("left")} disabled={busy} className={`${btn} border-[#f0d3a8] bg-[#fdf6e9] text-[#b9540f] hover:bg-[#fbeede]`}>Mark as left</button>}
        <button onClick={remove} disabled={busy} className={`${btn} border-[#f3c2c2] bg-[#fdeeee] text-[#b3261e] hover:bg-[#fbe3e3]`}>Remove</button>
      </div>
    </div>
  );
}

function StaffView({ staff }: { staff: Staff[] }) {
  const [inviting, setInviting] = useState(false);
  const [tab, setTab] = useState<"list" | "clockin">("list");
  const [selected, setSelected] = useState<Staff | null>(null);
  const [q, setQ] = useState("");
  const [roleF, setRoleF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [staffErr, setStaffErr] = useState<string | null>(null);
  const router = useRouter();
  const rows = staff;
  const filtered = rows.filter((r) => `${r.name} ${r.email} ${r.teacherType}`.toLowerCase().includes(q.toLowerCase()) && (roleF === "all" || r.role === roleF) && (statusF === "all" || r.status === statusF));
  const stats = [["Total staff", rows.length, "#2159e8", "#e7eefc"], ["Teachers", rows.filter((r) => r.role === "teacher").length, "#178a4c", "#e7f6ee"], ["Class teachers", rows.filter((r) => r.teacherType === "Class teacher").length, "#6b2fb3", "#f0e9fa"], ["Pending invites", rows.filter((r) => r.status === "pending").length, "#b9540f", "#fbeee3"]] as const;

  if (inviting) return <InviteWizard onClose={() => setInviting(false)} onDone={() => { setInviting(false); router.refresh(); }} />;

  return (
    <>
      <Head title="Staff management" subtitle="Roles, access, and staff clock-in attendance." action={tab === "list" ? <PrimaryBtn onClick={() => setInviting(true)}>{I(<><path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" /><circle cx="9" cy="7" r="3" /><path d="M19 8v6M22 11h-6" /></>)}Invite staff member</PrimaryBtn> : undefined} />
      <div className="mb-4 inline-flex rounded-[12px] border border-border-soft bg-white p-1">
        {([["list", "Staff list"], ["clockin", "Clock-in attendance"]] as const).map(([k, label]) => <button key={k} onClick={() => setTab(k)} className={`rounded-[9px] px-3.5 py-1.5 text-[12px] font-extrabold transition ${tab === k ? "bg-brand-blue text-white" : "text-ink-soft hover:text-brand-blue"}`}>{label}</button>)}
      </div>
      {tab === "clockin" ? <StaffClockInView /> : <>
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, color, bg]) => <div key={label} className="rounded-2xl border border-border-soft bg-white p-[18px]"><div className="flex items-center justify-between"><div><small className="font-bold text-ink-soft">{label}</small><strong className="mt-2 block font-display text-[26px] font-semibold leading-none">{value}</strong></div><span className="grid size-9 place-items-center rounded-full" style={{ backgroundColor: bg, color }}>{I(ICONS.staff)}</span></div></div>)}
      </div>
      <Card className="mt-[18px]">
        <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center"><div className="flex flex-1 items-center gap-2 rounded-[10px] border border-border-soft bg-paper/60 px-3"><span className="text-ink-soft">{I(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>)}</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff by name, email or role…" className="min-h-9 flex-1 bg-transparent text-[13px] outline-none" /></div><FilterSelect value={roleF} onChange={setRoleF} options={[{ v: "all", label: "All roles" }, { v: "teacher", label: "Teacher" }, { v: "principal", label: "Principal" }, { v: "vice_principal", label: "Vice principal" }, { v: "bursar", label: "Bursar" }]} /><FilterSelect value={statusF} onChange={setStatusF} options={[{ v: "all", label: "All statuses" }, { v: "active", label: "Active" }, { v: "pending", label: "Pending" }, { v: "inactive", label: "Inactive" }, { v: "left", label: "Left school" }]} /></div>
        {rows.length === 0 ? <Empty text="No staff yet. Click “Invite staff member” to add your first teacher or bursar." /> : filtered.length === 0 ? <Empty text="No staff match your filters." /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-[12px]">
          <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="py-2 font-bold">Staff member</th><th className="py-2 font-bold">Role</th><th className="py-2 font-bold">Teacher type</th><th className="py-2 font-bold">Subjects</th><th className="py-2 font-bold">Class</th><th className="py-2 font-bold">Status</th><th className="py-2 font-bold"></th></tr></thead>
          <tbody>{filtered.map((s, i) => <tr key={i} onClick={() => setSelected(s)} className="cursor-pointer border-b border-border-soft last:border-0 hover:bg-paper/60">
            <td className="py-2.5"><div className="flex items-center gap-2.5"><Avatar name={s.name} size={30} /><div><div className="font-bold text-ink">{s.name}</div><div className="text-[10px] text-ink-soft">{s.email}</div></div></div></td>
            <td className="py-2.5"><span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-extrabold text-brand-blue">{ROLE_LABEL[s.role] ?? s.role}</span></td>
            <td className="py-2.5 text-ink-soft">{s.teacherType}</td>
            <td className="py-2.5">{s.subjects.length ? <div className="flex flex-wrap gap-1">{s.subjects.slice(0, 2).map((x) => <span key={x} className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">{x}</span>)}{s.subjects.length > 2 && <span className="text-[10px] text-ink-soft">+{s.subjects.length - 2}</span>}</div> : <span className="text-ink-soft">—</span>}</td>
            <td className="py-2.5 text-ink-soft">{s.assignedClass ?? "—"}</td>
            <td className="py-2.5"><StaffStatusBadge status={s.status} /></td>
            <td className="py-2.5 text-right text-ink-soft">›</td>
          </tr>)}</tbody>
        </table></div>)}
      </Card>
      </>}

      {selected && <div className="fixed inset-0 z-50"><div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} /><aside className="absolute right-0 top-0 h-full w-[min(440px,100%)] overflow-y-auto bg-white p-6 shadow-[0_0_60px_rgba(16,33,63,.2)] motion-safe:animate-[fade-up_.2s_ease]">
        <div className="mb-5 flex items-center justify-between"><h2 className="font-display text-[20px] font-semibold">Staff details</h2><button onClick={() => setSelected(null)} className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-paper">✕</button></div>
        <div className="flex items-center gap-3.5"><Avatar name={selected.name} size={56} /><div><div className="font-display text-[17px] font-semibold">{selected.name}</div><div className="text-[12px] text-ink-soft">{selected.email}</div><div className="mt-0.5"><StaffStatusBadge status={selected.status} /></div></div></div>
        <dl className="mt-5 grid gap-0">{[["Staff ID", selected.staffNo ?? "—"], ["Role", ROLE_LABEL[selected.role] ?? selected.role], ["Type", selected.teacherType], ["Assigned class", selected.assignedClass ?? "—"], ["Subjects", selected.subjects.join(", ") || "—"], ["Approve payments", selected.canApprove ? "Yes" : "No"]].map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-border-soft py-2.5 last:border-0"><dt className="text-[12px] font-bold text-ink-soft">{k}</dt><dd className="max-w-[60%] text-right text-[12px] font-bold text-ink">{k === "Staff ID" && v !== "—" ? <code className="select-all text-brand-blue">{v}</code> : v}</dd></div>)}</dl>
        {selected.role !== "school_admin" && <StaffActions staff={selected} onDone={() => { setSelected(null); router.refresh(); }} onErr={setStaffErr} />}
        {staffErr && <p className="mt-2 text-[12px] font-bold text-[#b3261e]">{staffErr}</p>}
        <h3 className="mb-2 mt-6 font-display text-[15px] font-semibold">Permissions</h3>
        <div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><thead><tr className="text-[9px] uppercase tracking-wide text-ink-soft"><th className="py-1.5">Area</th>{LEVELS.map((l) => <th key={l.key} className="py-1.5 text-center font-bold">{l.label}</th>)}</tr></thead><tbody>{AREAS.map((a) => { const lvl = (selected.permissions[a] ?? "none") as Level; return <tr key={a} className="border-t border-border-soft"><td className="py-2 font-bold text-ink">{AREA_LABELS[a]}</td>{LEVELS.map((l) => <td key={l.key} className="py-2 text-center">{lvl !== "none" && rank[lvl] >= rank[l.key] ? <span className="text-brand-green">✓</span> : <span className="text-[#cdd7e6]">—</span>}</td>)}</tr>; })}</tbody></table></div>
        <p className="mt-4 rounded-lg bg-brand-soft/60 p-2.5 text-[10px] leading-relaxed text-ink-soft">Permissions are suggested from the role and responsibilities, then adjusted if needed.</p>
      </aside></div>}
    </>
  );
}

/* ---------- Profile ---------- */
/* ---------- Settings (school profile, logo, session/term, finance controls) ---------- */
function Settings({ school, logo, onLogo, onSaved }: { school: School; logo: string | null; onLogo: (v: string | null) => void; onSaved: (s: School) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [requireApproval, setRequireApproval] = useState(school.requireApproval);
  const [term, setTerm] = useState(school.currentTerm);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  async function uploadLogo(file: File) {
    setLogoBusy(true); setLogoMsg(null);
    const fd = new FormData(); fd.append("logo", file);
    const r = await uploadSchoolLogo(fd);
    setLogoBusy(false);
    if ("error" in r) { setLogoMsg(r.error); return; }
    onLogo(`${r.logoUrl}?t=${Date.now()}`);
  }
  async function removeLogo() { setLogoBusy(true); await removeSchoolLogo(); setLogoBusy(false); onLogo(null); }
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = { name: String(fd.get("name") || ""), email: String(fd.get("email") || ""), phone: String(fd.get("phone") || ""), state: String(fd.get("state") || ""), country: String(fd.get("country") || ""), address: String(fd.get("address") || ""), currentSession: String(fd.get("currentSession") || ""), currentTerm: term, requireApproval, dayStartsAt: String(fd.get("dayStartsAt") || ""), dayEndsAt: String(fd.get("dayEndsAt") || "") };
    setBusy(true); setMsg(null);
    const r = await updateSchoolProfile(input);
    setBusy(false); setMsg(r);
    if ("ok" in r) onSaved({ ...school, ...input });
  }
  return (
    <>
      <Head title="Settings" subtitle="Your school's profile, logo, academic session and controls." />
      <div className="grid gap-[18px] lg:grid-cols-[280px_1fr]">
        <Card title="School logo" className="h-fit">
          <div className="grid place-items-center gap-4 py-2">
            <div className="grid size-32 place-items-center overflow-hidden rounded-2xl border border-border-soft bg-paper">{logo ? <img src={logo} alt="School logo" className="size-full object-cover" /> : <span className="font-display text-[40px] font-bold text-brand-blue">{school.name.slice(0, 1)}</span>}</div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
            <div className="flex gap-2"><button disabled={logoBusy} onClick={() => fileRef.current?.click()} className="inline-flex min-h-9 items-center rounded-[10px] bg-brand-blue px-3.5 text-[12px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-70">{logoBusy ? "Working…" : "Change logo"}</button>{logo && <button disabled={logoBusy} onClick={removeLogo} className="inline-flex min-h-9 items-center rounded-[10px] border border-[#f3c2c2] bg-[#fdeeee] px-3.5 text-[12px] font-extrabold text-[#b3261e] transition hover:bg-[#fbe3e3]">Remove</button>}</div>
            {logoMsg && <p className="text-[11px] font-bold text-[#b3261e]">{logoMsg}</p>}
            <div className="text-center text-[10px] text-ink-soft">PNG or JPG, max 2MB.<br />School code: <code className="select-all font-bold text-brand-blue">{school.schoolCode}</code></div>
          </div>
        </Card>
        <Card title="School details">
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field label="School name" name="name" defaultValue={school.name} />
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Contact email" name="email" type="email" defaultValue={school.email ?? ""} placeholder="admin@school.edu.ng" /><Field label="Phone" name="phone" defaultValue={school.phone ?? ""} placeholder="+234 800 000 0000" /></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="State" name="state" defaultValue={school.state ?? ""} /><Field label="Country" name="country" defaultValue={school.country ?? ""} /></div>
          <Field label="Address" name="address" defaultValue={school.address ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Academic session" name="currentSession" defaultValue={school.currentSession} placeholder="2024/2025" />
            <label className="grid gap-1.5"><span className="text-[11px] font-extrabold text-ink">Current term</span><select value={term} onChange={(e) => setTerm(e.target.value)} className="min-h-10 rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] text-ink outline-none focus:border-brand-blue focus:bg-white">{["Term 1", "Term 2", "Term 3"].map((t) => <option key={t}>{t}</option>)}</select></label>
          </div>
          <div className="mt-1 rounded-[12px] border border-border-soft bg-paper/40 p-4">
            <div className="flex items-start justify-between gap-4">
              <div><div className="text-[13px] font-extrabold text-ink">Require a separate approver for payments</div><p className="mt-0.5 text-[11px] leading-relaxed text-ink-soft">Maker-checker: when on, a payment must be approved by a <strong className="text-ink">different</strong> staff member than the one who recorded it. Leave off if one person records and approves.</p></div>
              <button type="button" role="switch" aria-checked={requireApproval} onClick={() => setRequireApproval((v) => !v)} className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${requireApproval ? "bg-brand-blue" : "bg-border-soft"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${requireApproval ? "left-[22px]" : "left-0.5"}`} /></button>
            </div>
          </div>
          <div className="mt-1 rounded-[12px] border border-border-soft bg-paper/40 p-4">
            <div className="text-[13px] font-extrabold text-ink">School day hours</div>
            <p className="mt-0.5 mb-3 text-[11px] leading-relaxed text-ink-soft">Used on the staff clock-in register to flag <strong className="text-ink">Late</strong> arrivals and <strong className="text-ink">left-early</strong> departures. Leave blank to only record times without a verdict.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5"><span className="text-[11px] font-extrabold text-ink">Day starts at</span><input type="time" name="dayStartsAt" defaultValue={school.dayStartsAt ?? ""} className="min-h-10 rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] text-ink outline-none focus:border-brand-blue focus:bg-white" /></label>
              <label className="grid gap-1.5"><span className="text-[11px] font-extrabold text-ink">Day ends at</span><input type="time" name="dayEndsAt" defaultValue={school.dayEndsAt ?? ""} className="min-h-10 rounded-[10px] border border-border-soft bg-paper/60 px-3 text-[13px] text-ink outline-none focus:border-brand-blue focus:bg-white" /></label>
            </div>
          </div>
          <div className="flex items-center gap-3"><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-brand-blue px-5 text-[13px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark disabled:opacity-70">{busy ? "Saving…" : "Save changes"}</button>{msg?.ok && <span className="text-[12px] font-bold text-brand-green">Saved ✓</span>}{msg?.error && <span className="text-[12px] font-bold text-[#b3261e]">{msg.error}</span>}</div>
        </form>
        </Card>
      </div>
    </>
  );
}

/* ---------- Audit log ---------- */
function AuditLog({ audit }: { audit: Audit[] }) {
  return (
    <>
      <Head title="Audit log" subtitle="A record of important actions in your school." />
      <Card>
        {audit.length === 0 ? <Empty text="No activity recorded yet." /> : (
          <div className="grid gap-1.5">{audit.map((a, i) => <AuditRow key={i} a={a} />)}</div>
        )}
      </Card>
    </>
  );
}

function AuditRow({ a }: { a: Audit }) {
  const [open, setOpen] = useState(false);
  const changes = (Array.isArray(a.meta?.changes) ? a.meta!.changes : []) as { field: string; old: string; new: string }[];
  const by = `${a.actor ?? "system"}${a.actorRole ? ` (${a.actorRole})` : ""}`;
  const expandable = changes.length > 0;
  return (
    <div className="rounded-xl border border-border-soft">
      <button onClick={() => expandable && setOpen((v) => !v)} className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left ${expandable ? "cursor-pointer hover:bg-paper/60" : "cursor-default"}`}>
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-[11px] font-bold text-brand-blue">●</span>
        <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-bold text-ink">{a.detail || actLabel(a.action)}</div><div className="text-[10px] text-ink-soft">{actLabel(a.action)} · by {by} · {relTime(a.ts)}</div></div>
        {expandable && <span className={`shrink-0 text-[11px] font-extrabold text-brand-blue transition ${open ? "rotate-180" : ""}`}>▾</span>}
      </button>
      {open && expandable && (
        <div className="border-t border-border-soft bg-paper/40 px-3.5 py-3">
          <div className="mb-2 grid gap-1 text-[11px] sm:grid-cols-2"><div><span className="font-bold text-ink-soft">Changed by</span> <span className="font-bold text-ink">{by}</span></div><div><span className="font-bold text-ink-soft">Module</span> <span className="font-bold text-ink">{a.entityType}</span></div></div>
          <div className="overflow-x-auto rounded-lg border border-border-soft bg-white"><table className="w-full min-w-[360px] text-left text-[11px]"><thead><tr className="border-b border-border-soft text-[9px] uppercase tracking-wide text-ink-soft"><th className="px-2.5 py-1.5 font-bold">Field</th><th className="px-2.5 py-1.5 font-bold">Old value</th><th className="px-2.5 py-1.5 font-bold">New value</th></tr></thead>
            <tbody>{changes.map((ch, j) => <tr key={j} className="border-b border-border-soft last:border-0"><td className="px-2.5 py-1.5 font-bold capitalize text-ink">{ch.field}</td><td className="px-2.5 py-1.5 text-ink-soft line-through decoration-[#b3261e]/40">{ch.old}</td><td className="px-2.5 py-1.5 font-bold text-brand-green">{ch.new}</td></tr>)}</tbody></table></div>
        </div>
      )}
    </div>
  );
}

/* ---------- Coming soon placeholder ---------- */
function ComingSoon({ name }: { name: string }) {
  return <><Head title={name} subtitle={`The ${name} module is coming soon.`} /><div className="grid place-items-center rounded-2xl border border-dashed border-border-soft bg-white py-20 text-center"><div className="mb-3 grid size-12 place-items-center rounded-xl bg-brand-soft text-brand-blue">{I(ICONS[name.toLowerCase()] ?? ICONS.reports)}</div><h2 className="font-display text-[18px] font-semibold">{name} is on the way</h2><p className="mt-1 max-w-sm text-[13px] text-ink-soft">We&rsquo;re building this module. You&rsquo;ll manage {name.toLowerCase()} right here soon.</p></div></>;
}
