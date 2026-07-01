"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/client";
import { AddStudentForm, ResetStudentPasswordForm } from "./people-forms";
import { BarChart, DonutChart } from "./charts";
import { roleLabel, formatNaira as naira, compactNaira as compactN } from "@/lib/format";
import { InviteWizard } from "./invite-wizard";
import { FinanceArea, type FinanceSection } from "./finance-view";
import { StudentNavProvider } from "./student-nav";
import { PromotionScreen } from "./promotion";
import { DeviceApprovals } from "./device-approvals";
import { SessionManager } from "./session-manager";
import { TwoFactorSettings } from "./two-factor-settings";

const FINANCE_SUB: [FinanceSection, string][] = [["record", "Record payment"], ["approvals", "Approvals"], ["bills", "Bills & fee structures"], ["invoices", "Invoices & receipts"], ["classsummary", "Class finance summary"], ["overpayments", "Overpayments & refunds"], ["reports", "Report card"]];
type StudentsSection = "classes" | "logins" | "add" | "promote";
const STUDENTS_SUB: [StudentsSection, string][] = [["classes", "🏫 Manage classes"], ["logins", "🔑 Logins"], ["add", "Add student"], ["promote", "⬆ Promote students"]];
import { StudentProfilePage } from "./student-profile";
import { EmptyArt } from "./illustration";
import { CalendarCard } from "./calendar";
import { GreetingBanner } from "./greeting-banner";
import { StudentCredentials } from "./credentials";
import { ClassManager } from "./class-manager";
import { DeviceApprovalPopup } from "./device-approval-popup";
import { StaffClockInView } from "./attendance-view";
import { StudentAttendanceView } from "./student-attendance-view";
import { updateSchoolProfile, uploadSchoolLogo, removeSchoolLogo } from "@/lib/actions/school";
import { TermSwitcher } from "./term-switcher";
import { TimetableGrid } from "./timetable-view";
import { useClassNames } from "./use-classes";
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
type Props = { userName: string; school: School; students: Student[]; staff: Staff[]; audit: Audit[]; overview: AdminOverview; initialSection?: string; restricted?: boolean };

const I = (p: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">{p}</svg>;
const ICONS: Record<string, React.ReactNode> = {
  overview: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  students: <><path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" /><circle cx="9" cy="7" r="3" /><path d="M22 19v-1a4 4 0 0 0-3-3.87" /></>,
  staff: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  attendance: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  finance: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>,
  messages: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
  communications: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
  exams: <><path d="M9 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-3" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="m9 14 2 2 4-4" /></>,
  timetable: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  reports: <><path d="M3 3v18h18" /><path d="M7 14l3-3 3 3 5-5" /></>,
  profile: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M15 8h3M15 12h3M7 16h10" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.4l.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 11 4.6V4.5a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 19 5.4a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 11V11a2 2 0 0 1 0 4Z" /></>,
  audit: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></>,
};
const NAV: [string, string, number?][] = [["overview", "Overview"], ["students", "Classes"], ["staff", "Staff"], ["attendance", "Attendance"], ["finance", "Finance"], ["exams", "Exams"], ["timetable", "Timetable"], ["reports", "Grade and reports"], ["communications", "Communications"], ["settings", "Settings"], ["audit", "Audit log"]];

function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(); }
const AV_COLORS = ["#2159e8", "#178a4c", "#b9540f", "#6b2fb3", "#0d8aa8"];
function Avatar({ name, size = 30 }: { name: string; size?: number }) { const c = AV_COLORS[name.length % AV_COLORS.length]; return <span className="grid shrink-0 place-items-center rounded-full font-extrabold text-white" style={{ width: size, height: size, backgroundColor: c, fontSize: size * 0.36 }}>{initials(name)}</span>; }

export function AdminApp({ userName, school, students, staff, audit, overview, initialSection = "overview", restricted = false }: Props) {
  const [active, setActive] = useState(initialSection);
  // The secretary runs this same interface minus staff management, school settings and finance approval.
  const nav = restricted ? NAV.filter(([k]) => k !== "staff" && k !== "settings") : NAV;
  const accountLabel = restricted ? "Secretary" : "School Admin";
  const [financeSection, setFinanceSection] = useState<FinanceSection | null>(null);
  const [studentsSection, setStudentsSection] = useState<StudentsSection | null>(null);
  // Which collapsible nav groups (finance/students) are expanded in the sidebar.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialSection === "finance" || initialSection === "students" ? [initialSection] : []));
  const toggleGroup = (key: string) => setExpanded((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const [open, setOpen] = useState(false);
  const [logo, setLogo] = useState<string | null>(school.logoKey);
  const [details, setDetails] = useState(school);
  const [notifOpen, setNotifOpen] = useState(false);
  const [deepStudent, setDeepStudent] = useState<string | null>(null);
  const router = useRouter();
  async function logout() { await signOut(); router.push("/login"); }
  // Single navigation entry point so notifications/activity can jump to a section (and optionally a student).
  function navigate(section: string, studentId?: string) { if (studentId) setDeepStudent(studentId); setActive(section); if (section === "finance" || section === "students") setExpanded((p) => new Set(p).add(section)); setOpen(false); }
  function onNotif(a: Audit) { const t = navTarget(a); navigate(t.section, t.studentId); }

  const sidebar = (
    <>
      {/* Full-bleed logo: spans the entire width of the sidebar header (and bleeds into the top padding). */}
      <div className="-mx-4 -mt-[20px] mb-[14px] overflow-hidden bg-white/[0.06]">
        <div className="aspect-[4/3] w-full">
          {logo ? <img src={logo} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center"><span className="grid size-20 rotate-45 place-items-center border-2 border-brand-green"><i className="size-5 border-2 border-brand-green" /></span></div>}
        </div>
        <div className="px-4 pb-3.5 pt-2 text-center">
          <div className="line-clamp-2 font-display text-[17px] font-bold leading-tight text-white">{details.name}</div>
          <div className="mt-0.5 text-[11px] text-sidebar-muted">Excellence in Education</div>
        </div>
      </div>
      <nav className="grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto">
        {nav.map(([key, label, badge]) => (
          <div key={key}>
            <button onClick={() => { const collapsible = key === "finance" || key === "students"; if (collapsible) { if (active === key) toggleGroup(key); else { setActive(key); setExpanded((p) => new Set(p).add(key)); } } else { setActive(key); setOpen(false); } }} className={`flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-[13px] font-bold transition ${active === key ? "bg-sidebar-active text-white" : "text-sidebar-faint hover:bg-white/10"}`}>
              {I(ICONS[key])}<span className="flex-1 text-left">{label}</span>{(key === "finance" || key === "students") ? <span className={`transition ${expanded.has(key) ? "rotate-180" : ""}`}>{I(<path d="m6 9 6 6 6-6" />)}</span> : badge ? <span className="grid size-[18px] place-items-center rounded-full bg-brand-green text-[9px] text-white">{badge}</span> : null}
            </button>
            {key === "finance" && expanded.has("finance") && (
              <div className="mb-1 mt-0.5 grid gap-0.5 border-l border-white/10 pl-3.5">
                {FINANCE_SUB.map(([sk, sl]) => (
                  <button key={sk} onClick={() => { setActive("finance"); setFinanceSection(sk); setOpen(false); }} className={`flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-left text-[12px] font-bold transition ${active === "finance" && financeSection === sk ? "bg-white/10 text-white" : "text-sidebar-muted hover:bg-white/5 hover:text-white"}`}><span className={`size-1.5 rounded-full ${active === "finance" && financeSection === sk ? "bg-brand-green" : "bg-white/20"}`} />{sl}</button>
                ))}
              </div>
            )}
            {key === "students" && expanded.has("students") && (
              <div className="mb-1 mt-0.5 grid gap-0.5 border-l border-white/10 pl-3.5">
                {STUDENTS_SUB.map(([sk, sl]) => (
                  <button key={sk} onClick={() => { setActive("students"); setStudentsSection(sk); setOpen(false); }} className={`flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-left text-[12px] font-bold transition ${active === "students" && studentsSection === sk ? "bg-white/10 text-white" : "text-sidebar-muted hover:bg-white/5 hover:text-white"}`}><span className={`size-1.5 rounded-full ${active === "students" && studentsSection === sk ? "bg-brand-green" : "bg-white/20"}`} />{sl}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="mt-auto border-t border-white/15 pt-3.5">
        <div className="flex items-center gap-2.5"><Avatar name={userName} size={34} /><div className="min-w-0 flex-1 text-[11px] text-white"><div className="truncate font-bold">{userName}</div><div className="text-sidebar-muted">{accountLabel}</div></div></div>
        <SupportMenu />
        {/* Sign out is in the top-right account menu on desktop; surface it in the drawer on mobile. */}
        <button onClick={logout} className="mt-1 flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[12px] font-bold text-sidebar-faint transition hover:bg-white/10 hover:text-white lg:hidden">{I(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>)}<span className="flex-1 text-left">Sign out</span></button>
      </div>
    </>
  );

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[244px_1fr]">
      <aside className="hidden flex-col bg-ink px-4 py-[20px] lg:flex lg:sticky lg:top-0 lg:h-screen">{sidebar}</aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} /><aside className="absolute left-0 top-0 flex h-full w-[min(260px,85vw)] flex-col overflow-y-auto bg-ink px-4 py-[20px] motion-safe:animate-[fade-up_.2s_ease]">{sidebar}</aside></div>}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 hidden items-center justify-end gap-1.5 border-b border-border-soft bg-white/95 px-7 py-2.5 backdrop-blur lg:flex">
          {!restricted && <button onClick={() => setActive("settings")} aria-label="Settings" title="Settings" className="grid size-10 place-items-center rounded-full text-ink-soft transition hover:bg-paper hover:text-brand-blue">{I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>)}</button>}
          <NotifBell open={notifOpen} setOpen={setNotifOpen} audit={audit} onViewAll={() => setActive("audit")} onNavigate={onNotif} />
          <div className="mx-1 h-7 w-px bg-border-soft" />
          <UserMenu userName={userName} accountLabel={accountLabel} showSettings={!restricted} onSettings={() => setActive("settings")} onLogout={logout} />
        </header>
        <header className="flex items-center justify-between gap-3 border-b border-border-soft bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid size-10 place-items-center rounded-[10px] border border-border-soft">{I(<><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>)}</button>
          <span className="font-display text-[18px] font-semibold">{NAV.find((n) => n[0] === active)?.[1]}</span>
          <div className="flex items-center gap-1.5">
            <NotifBell open={notifOpen} setOpen={setNotifOpen} audit={audit} onViewAll={() => setActive("audit")} onNavigate={onNotif} />
            <UserMenu userName={userName} accountLabel={accountLabel} showSettings={!restricted} onSettings={() => setActive("settings")} onLogout={logout} />
          </div>
        </header>

        <main className="overflow-x-hidden p-4 pb-24 sm:p-6 sm:pb-24 lg:px-7 lg:py-6 lg:pb-6">
          <StudentNavProvider value={{ openStudent: (id) => navigate("students", id) }}>
          {active === "overview" && <Overview userName={userName} school={details} students={students} staff={staff} audit={audit} overview={overview} notifOpen={notifOpen} setNotifOpen={setNotifOpen} goto={navigate} onNotif={onNotif} onSchoolChange={(patch) => setDetails((d) => ({ ...d, ...patch }))} canManageTerm={!restricted} />}
          {active === "students" && <Students students={students} openStudentId={deepStudent} onConsumed={() => setDeepStudent(null)} section={studentsSection} onSection={setStudentsSection} />}
          {active === "staff" && !restricted && <><DeviceApprovals /><StaffView staff={staff} /></>}
          {active === "settings" && !restricted && <div className="grid gap-[18px]"><Settings school={details} logo={logo} onLogo={setLogo} onSaved={setDetails} /><TwoFactorSettings /><SessionManager /></div>}
          {active === "audit" && <AuditLog audit={audit} />}
          {active === "finance" && <FinanceArea section={financeSection} onPick={setFinanceSection} />}
          {active === "attendance" && <StudentAttendanceView />}
          {active === "timetable" && <TimetableAdmin />}
          {["exams", "communications", "reports"].includes(active) && <ComingSoon name={NAV.find((n) => n[0] === active)![1]} />}
          </StudentNavProvider>
        </main>

        {/* Mobile bottom tab bar - quick access to the top sections; "More" opens the full drawer. */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border-soft bg-white/95 backdrop-blur lg:hidden">
          {([
            ["overview", "Overview", <><path key="a" d="M3 9.5 12 3l9 6.5" /><path key="b" d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" /></>, false],
            ["students", "Classes", ICONS.students, false],
            ["finance", "Finance", ICONS.finance, false],
            ["reports", "Reports", ICONS.reports, false],
            ["__more", "More", <><circle key="a" cx="5" cy="12" r="1.6" /><circle key="b" cx="12" cy="12" r="1.6" /><circle key="c" cx="19" cy="12" r="1.6" /></>, true],
          ] as [string, string, React.ReactNode, boolean][]).map(([key, label, icon, filled]) => {
            const isMore = key === "__more";
            const act = isMore ? !["overview", "students", "finance", "reports"].includes(active) : active === key;
            return (
              <button key={key} onClick={() => { if (isMore) setOpen(true); else { setActive(key); window.scrollTo(0, 0); } }} className={`flex flex-col items-center gap-1 py-2 text-[10px] font-bold transition ${act ? "text-brand-blue" : "text-ink-soft"}`}>
                <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[22px]">{icon}</svg>
                {label}
              </button>
            );
          })}
        </nav>
      </div>
      <DeviceApprovalPopup />
    </div>
  );
}

/* ---------- shared ---------- */
const SUPPORT_EMAIL = "support@edumod.app";
const HELP_URL = "https://edumod.app/help";
// Sits at the foot of the sidebar (sign-out now lives in the top-right account menu). Opens a
// popover upward with the common support actions.
function SupportMenu() {
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
        <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Edumod bug report")}`} onClick={() => setOpen(false)} className={`${item} text-danger hover:bg-danger-soft`}>{I(<><path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6zM12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" /></>)} Report a problem</a>
      </div></>}
    </div>
  );
}
function UserMenu({ userName, onSettings, onLogout, accountLabel = "School Admin", showSettings = true }: { userName: string; onSettings: () => void; onLogout: () => void; accountLabel?: string; showSettings?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label="Account menu" className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition hover:bg-paper">
        <Avatar name={userName} size={34} />
        <span className="hidden text-left sm:block"><span className="block max-w-[140px] truncate text-[12px] font-bold leading-tight text-ink">{userName}</span><span className="block text-[11px] leading-tight text-ink-soft">{accountLabel}</span></span>
        <span className={`text-ink-soft transition ${open ? "rotate-180" : ""}`}>{I(<path d="m6 9 6 6 6-6" />)}</span>
      </button>
      {open && <><div className="fixed inset-0 z-40" onClick={() => setOpen(false)} /><div className="absolute right-0 top-12 z-50 w-48 rounded-xl border border-border-soft bg-white p-1.5 shadow-[0_20px_50px_rgba(16,33,63,.16)] motion-safe:animate-[fade-up_.2s_ease]">
        {showSettings && <button onClick={() => { setOpen(false); onSettings(); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-bold text-ink transition hover:bg-paper">{I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>)} Settings</button>}
        <button onClick={() => { setOpen(false); onLogout(); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-bold text-danger transition hover:bg-danger-soft">{I(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>)} Sign out</button>
      </div></>}
    </div>
  );
}
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

/* ---------- Overview ---------- */
function WelcomeBanner({ userName, school, onSchoolChange, canManage }: { userName: string; school: School; onSchoolChange: (patch: Partial<School>) => void; canManage: boolean }) {
  // Everyone routed through AdminApp (admin + secretary) can switch the active term; only the admin
  // (canManage) can add/remove terms. Enforced server-side too.
  return (
    <GreetingBanner
      userName={userName}
      subtitle={`${school.currentTerm} · ${school.currentSession} session · here’s what’s happening today.`}
      control={<TermSwitcher canManage={canManage} onChange={(session, term) => onSchoolChange({ currentSession: session, currentTerm: term })} />}
    />
  );
}

function feeTrendOf(series: { label: string; value: number }[]) {
  const v = series.map((p) => p.value);
  const last = v[v.length - 1], prev = v[v.length - 2];
  if (prev === undefined || last === undefined || prev <= 0) return null;
  const pct = Math.round((Math.abs(last - prev) / prev) * 100 * 10) / 10;
  return { up: last >= prev, pct: `${pct}%`, note: "vs last month" };
}
type StatCardProps = { label: string; value: string; icon: React.ReactNode; color: string; meta: string; trend?: { up: boolean; pct: string; note: string } | null; onClick: () => void };
function StatCard({ label, value, icon, color, meta, trend, onClick }: StatCardProps) {
  return (
    <button onClick={onClick} className="group relative overflow-hidden rounded-2xl border border-border-soft bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(16,33,63,.08)]">
      <span className="absolute right-3 top-3 text-ink-soft/40 transition group-hover:translate-x-0.5 group-hover:text-brand-blue">{I(<path d="m9 18 6-6-6-6" />)}</span>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl text-white" style={{ backgroundColor: color }}>{I(icon)}</span>
        <div className="min-w-0 pr-4">
          <strong className="block break-words font-display text-[clamp(19px,5vw,25px)] font-bold leading-none" style={{ color }}>{value}</strong>
          <small className="mt-1.5 block font-bold text-ink">{label}</small>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-extrabold">
            {trend && <span className={trend.up ? "text-brand-green" : "text-danger"}>{trend.up ? "↑" : "↓"} {trend.pct}</span>}
            <span className="text-ink-soft">{trend ? trend.note : meta}</span>
          </div>
        </div>
      </div>
      <span aria-hidden className="pointer-events-none absolute -bottom-3 -right-2 opacity-[0.06]" style={{ color }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="size-20">{icon}</svg></span>
    </button>
  );
}

function actStyle(action: string): { bg: string; color: string; icon: React.ReactNode } {
  if (action.startsWith("payment")) return { bg: "#e7f6ee", color: "#178a4c", icon: ICONS.finance };
  if (action.startsWith("attendance")) return { bg: "#e7f6ee", color: "#178a4c", icon: ICONS.attendance };
  if (action.startsWith("student")) return { bg: "#e7eefc", color: "#2159e8", icon: ICONS.students };
  if (action.startsWith("staff")) return { bg: "#fbeee3", color: "#b9540f", icon: ICONS.staff };
  if (action.startsWith("result") || action.startsWith("grade")) return { bg: "#f0e9fa", color: "#6b2fb3", icon: ICONS.reports };
  if (action.includes("event") || action.includes("class")) return { bg: "#e7eefc", color: "#2159e8", icon: ICONS.timetable };
  return { bg: "#eef2f9", color: "#5b6b86", icon: ICONS.overview };
}
function ActivityRow({ a, onClick }: { a: Audit; onClick: () => void }) {
  const s = actStyle(a.action);
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-paper/60">
      <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{I(s.icon)}</span>
      <div className="min-w-0 flex-1"><strong className="block truncate text-[12px]">{a.detail || actLabel(a.action)}</strong><span className="text-[10px] text-ink-soft">{actLabel(a.action)} · {a.actor ?? "system"}</span></div>
      <span className="shrink-0 text-[10px] text-ink-soft">{relTime(a.ts)}</span>
    </button>
  );
}

const BOOK_ICON = <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>;
const SECTION_META: { label: string; sub: string; color: string; bg: string; match: (n: string) => boolean }[] = [
  { label: "Primary School", sub: "Pre-KG to Primary 6", color: "#178a4c", bg: "#e7f6ee", match: (n) => /^(primary|pre|nursery|kg|basic)/i.test(n) },
  { label: "Junior Secondary (JSS)", sub: "JSS 1 to JSS 3", color: "#2159e8", bg: "#e7eefc", match: (n) => /^(jss|junior)/i.test(n) },
  { label: "Senior Secondary (SSS)", sub: "SSS 1 to SSS 3", color: "#6b2fb3", bg: "#f0e9fa", match: (n) => /^(sss|senior)/i.test(n) },
  { label: "Vocational / Other", sub: "Skills & extra-curricular", color: "#b9540f", bg: "#fbeee3", match: () => true },
];
function ClassesOverviewCard({ classList, onAll }: { classList: { className: string; count: number }[]; onAll: () => void }) {
  const counts = SECTION_META.map(() => 0);
  for (const c of classList) { const idx = SECTION_META.findIndex((s) => s.match(c.className)); counts[idx >= 0 ? idx : SECTION_META.length - 1]++; }
  return (
    <Card title="Classes overview" action={<button onClick={onAll} className="text-[11px] font-extrabold text-brand-blue hover:underline">View all</button>}>
      <ul className="grid gap-2">{SECTION_META.map((s, i) => (
        <li key={s.label} className="flex items-center gap-3 rounded-xl border border-border-soft px-3 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: s.bg, color: s.color }}>{I(BOOK_ICON)}</span>
          <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-bold text-ink">{s.label}</div><div className="text-[10px] text-ink-soft">{s.sub}</div></div>
          <span className="rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ backgroundColor: s.bg, color: s.color }}>{counts[i]}</span>
        </li>
      ))}</ul>
    </Card>
  );
}

function Overview({ userName, school, students, staff, audit, overview, goto, onNotif, onSchoolChange, canManageTerm }: { userName: string; school: School; students: Student[]; staff: Staff[]; audit: Audit[]; overview: AdminOverview; notifOpen: boolean; setNotifOpen: (v: boolean) => void; goto: (s: string, studentId?: string) => void; onNotif: (a: Audit) => void; onSchoolChange: (patch: Partial<School>) => void; canManageTerm: boolean }) {
  const totalStudents = students.length;
  const teachers = staff.filter((s) => s.teacherType.includes("teacher") || s.role === "teacher").length || staff.length;
  const { jss, sss, primary, other } = overview.sections;
  const expected = overview.collected + overview.outstanding;
  const rate = expected ? Math.round((overview.collected / expected) * 100) : 0;
  const hasSeries = overview.series.some((p) => p.value > 0);
  const stats: StatCardProps[] = [
    { label: "Total students", value: totalStudents.toLocaleString(), icon: ICONS.students, color: "#178a4c", meta: totalStudents ? "Enrolled this session" : "Add your first student", onClick: () => goto("students") },
    { label: "Teaching staff", value: String(staff.length), icon: ICONS.staff, color: "#6b2fb3", meta: `${teachers} teaching`, onClick: () => goto("staff") },
    { label: "Fees collected", value: compactN(overview.collected), icon: ICONS.finance, color: "#c2710c", meta: "This term", trend: feeTrendOf(overview.series), onClick: () => goto("finance") },
    { label: "Outstanding", value: compactN(overview.outstanding), icon: ICONS.reports, color: "#d4351c", meta: "Across all invoices", onClick: () => goto("finance") },
  ];
  const segments = [
    { label: "Primary", value: primary, color: "#178a4c" },
    { label: "JSS", value: jss, color: "#2159e8" },
    { label: "SSS", value: sss, color: "#6b2fb3" },
    ...(other ? [{ label: "Other", value: other, color: "#b9540f" }] : []),
  ].filter((s) => s.value > 0);
  return (
    <>
      <WelcomeBanner userName={userName} school={school} onSchoolChange={onSchoolChange} canManage={canManageTerm} />

      {/* Mobile: calendar sits under the greeting, before the stat cards. On desktop it lives in the right rail. */}
      <div className="mb-[18px] xl:hidden"><CalendarCard canManage /></div>

      <div className="grid gap-[18px] xl:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {stats.map((s) => <StatCard key={s.label} {...s} />)}
          </div>

          <div className="mt-[18px] grid gap-[18px] lg:grid-cols-[1.4fr_1fr]">
            <Card title="Fee collection overview" action={<span className="rounded-lg border border-border-soft px-2.5 py-1 text-[11px] font-bold text-ink-soft">This academic year</span>}>
              {hasSeries ? <>
                <BarChart yMax={Math.max(...overview.series.map((p) => p.value)) * 1.2 || 1000} yLabel={(n) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(0)}M` : `${Math.round(n / 1000)}k`)} data={overview.series} />
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-soft pt-3.5 text-center">
                  <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Total collected</div><div className="mt-0.5 font-display text-[15px] font-bold text-brand-green">{naira(overview.collected)}</div></div>
                  <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Collection rate</div><div className="mt-0.5 font-display text-[15px] font-bold text-brand-blue">{rate}%</div></div>
                  <div><div className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">Total expected</div><div className="mt-0.5 font-display text-[15px] font-bold text-ink">{naira(expected)}</div></div>
                </div>
              </> : <Empty text="No approved payments yet. Collections chart here as payments are approved." />}
            </Card>
            <Card title="Students by section" action={<button onClick={() => goto("students")} className="text-[11px] font-extrabold text-brand-blue hover:underline">View all</button>}>
              {segments.length ? <DonutChart total={totalStudents} segments={segments} /> : <Empty text="Assign classes to students to see the breakdown." />}
            </Card>
          </div>

          <div className="mt-[18px]">
            <Card title="Recent activity" action={<button onClick={() => goto("audit")} className="text-[11px] font-extrabold text-brand-blue hover:underline">View all</button>}>
              {audit.length === 0 ? <Empty text="No activity yet. Actions in your school will appear here." /> : <div className="grid gap-x-5 sm:grid-cols-2">{audit.slice(0, 8).map((a, i) => <ActivityRow key={i} a={a} onClick={() => onNotif(a)} />)}</div>}
            </Card>
          </div>
        </div>

        {/* Right rail (calendar hidden on mobile - it's shown under the greeting instead) */}
        <div className="grid content-start gap-[18px]">
          <div className="hidden xl:block"><CalendarCard canManage /></div>
          <ClassesOverviewCard classList={overview.classList} onAll={() => goto("students")} />
          <Card title="Top performers" action={<button onClick={() => goto("students")} className="text-[11px] font-extrabold text-brand-blue hover:underline">All</button>}>
            {overview.topPerformers.length === 0 ? <p className="text-[12px] text-ink-soft">Record results to see top performers.</p> : <ol className="grid gap-1.5">{overview.topPerformers.map((p, i) => <li key={i} className="flex items-center gap-2.5 text-[12px]"><span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-extrabold ${i === 0 ? "bg-[#f4b740] text-white" : "bg-brand-soft text-brand-blue"}`}>{i + 1}</span><div className="min-w-0 flex-1"><div className="truncate font-bold text-ink">{p.name}</div><div className="text-[10px] text-ink-soft">{p.className ?? "-"}</div></div><span className="font-extrabold text-brand-green">{p.average}%</span></li>)}</ol>}
          </Card>
        </div>
      </div>
    </>
  );
}

/* ---------- Students ---------- */
function Students({ students, openStudentId, onConsumed, section, onSection }: { students: Student[]; openStudentId?: string | null; onConsumed?: () => void; section: StudentsSection | null; onSection: (s: StudentsSection | null) => void }) {
  // Which panel is open is driven by the sidebar "Classes" dropdown (and the header buttons mirror it).
  const showClasses = section === "classes";
  const showLogins = section === "logins";
  const showAdd = section === "add";
  const showPromote = section === "promote";
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();
  // Deep-link from a notification (e.g. "result saved for …") opens that student's profile.
  useEffect(() => { if (openStudentId) { setSelected(openStudentId); onConsumed?.(); } }, [openStudentId]); // eslint-disable-line react-hooks/exhaustive-deps
  const clsOf = (r: Student) => r.className || (r.createdAt.includes("·") ? r.createdAt.split("·")[0].trim() : "-");
  const [classF, setClassF] = useState("all");
  const [page, setPage] = useState(1);
  const per = 10;
  const classOpts = ["all", ...Array.from(new Set(students.map(clsOf))).filter((c) => c !== "-")];
  const filtered = useMemo(() => students.filter((r) => `${r.name} ${r.admissionNo}`.toLowerCase().includes(q.toLowerCase()) && (classF === "all" || clsOf(r) === classF)), [students, q, classF]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(filtered.length / per));
  const cur = Math.min(page, pages);
  const slice = filtered.slice((cur - 1) * per, cur * per);
  if (selected) return <StudentProfilePage studentId={selected} onBack={() => setSelected(null)} onChanged={() => router.refresh()} />;
  return (
    <>
      <Head title="Classes" subtitle={`${students.length.toLocaleString()} student${students.length === 1 ? "" : "s"} enrolled`} action={<div className="flex flex-wrap gap-2"><button onClick={() => onSection(showClasses ? null : "classes")} className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-border-soft bg-white px-3.5 text-[13px] font-extrabold text-ink-soft transition hover:border-brand-blue hover:text-brand-blue">🏫 {showClasses ? "Close" : "Manage classes"}</button><button onClick={() => onSection(showLogins ? null : "logins")} className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-border-soft bg-white px-3.5 text-[13px] font-extrabold text-ink-soft transition hover:border-brand-blue hover:text-brand-blue">🔑 {showLogins ? "Close" : "Logins"}</button><PrimaryBtn onClick={() => onSection(showAdd ? null : "add")}>{showAdd ? I(<><path d="M18 6 6 18M6 6l12 12" /></>) : I(<><path d="M12 5v14M5 12h14" /></>)}{showAdd ? "Close" : "Add student"}</PrimaryBtn></div>} />
      {showClasses && <div className="mb-[18px]"><ClassManager /></div>}
      {showAdd && <div className="mb-[18px]"><Card title="Add a student"><div className="grid gap-[18px] sm:grid-cols-2"><AddStudentForm /><div className="border-t border-border-soft pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"><p className="mb-3 text-[12px] font-extrabold text-ink">Reset a student&rsquo;s password</p><ResetStudentPasswordForm /></div></div></Card></div>}
      {showLogins && <div className="mb-[18px]"><Card title="Student logins"><StudentCredentials students={students} /></Card></div>}
      {showPromote && <div className="mb-[18px]"><PromotionScreen /></div>}
      {!showPromote && !showClasses && <Card>
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
      </Card>}
    </>
  );
}
function PageBtn({ children, active, disabled, onClick }: { children: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button onClick={onClick} disabled={disabled} className={`grid size-7 place-items-center rounded-md border text-[11px] font-bold transition disabled:opacity-40 ${active ? "border-brand-blue bg-brand-blue text-white" : "border-border-soft text-ink-soft hover:bg-paper"}`}>{children}</button>;
}

/* ---------- Staff ---------- */
const rank: Record<Level, number> = { none: 0, view: 1, edit: 2, approve: 3, full: 4 };
function StaffStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = { active: ["Active", "bg-brand-green/10 text-brand-green"], pending: ["Pending", "bg-brand-soft text-brand-blue"], inactive: ["Inactive", "bg-paper text-ink-soft"], left: ["Left school", "bg-danger-soft text-danger"] };
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
        {staff.status !== "left" && <button onClick={() => set("left")} disabled={busy} className={`${btn} border-warn-line bg-warn-soft text-warn hover:bg-[#fbeede]`}>Mark as left</button>}
        <button onClick={remove} disabled={busy} className={`${btn} border-danger-line bg-danger-soft text-danger hover:bg-danger-soft`}>Remove</button>
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
        <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center"><div className="flex flex-1 items-center gap-2 rounded-[10px] border border-border-soft bg-paper/60 px-3"><span className="text-ink-soft">{I(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>)}</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff by name, email or role…" className="min-h-9 flex-1 bg-transparent text-[13px] outline-none" /></div><FilterSelect value={roleF} onChange={setRoleF} options={[{ v: "all", label: "All roles" }, { v: "teacher", label: "Teacher" }, { v: "principal", label: "Principal" }, { v: "vice_principal", label: "Vice principal" }, { v: "secretary", label: "Secretary" }]} /><FilterSelect value={statusF} onChange={setStatusF} options={[{ v: "all", label: "All statuses" }, { v: "active", label: "Active" }, { v: "pending", label: "Pending" }, { v: "inactive", label: "Inactive" }, { v: "left", label: "Left school" }]} /></div>
        {rows.length === 0 ? <Empty text="No staff yet. Click “Invite staff member” to add your first teacher or secretary." /> : filtered.length === 0 ? <Empty text="No staff match your filters." /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-[12px]">
          <thead><tr className="border-b border-border-soft text-[10px] uppercase tracking-wide text-ink-soft"><th className="py-2 font-bold">Staff member</th><th className="py-2 font-bold">Role</th><th className="py-2 font-bold">Teacher type</th><th className="py-2 font-bold">Subjects</th><th className="py-2 font-bold">Class</th><th className="py-2 font-bold">Status</th><th className="py-2 font-bold"></th></tr></thead>
          <tbody>{filtered.map((s, i) => <tr key={i} onClick={() => setSelected(s)} className="cursor-pointer border-b border-border-soft last:border-0 hover:bg-paper/60">
            <td className="py-2.5"><div className="flex items-center gap-2.5"><Avatar name={s.name} size={30} /><div><div className="font-bold text-ink">{s.name}</div><div className="text-[10px] text-ink-soft">{s.email}</div></div></div></td>
            <td className="py-2.5"><span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-extrabold text-brand-blue">{roleLabel(s.role)}</span></td>
            <td className="py-2.5 text-ink-soft">{s.teacherType}</td>
            <td className="py-2.5">{s.subjects.length ? <div className="flex flex-wrap gap-1">{s.subjects.slice(0, 2).map((x) => <span key={x} className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">{x}</span>)}{s.subjects.length > 2 && <span className="text-[10px] text-ink-soft">+{s.subjects.length - 2}</span>}</div> : <span className="text-ink-soft">-</span>}</td>
            <td className="py-2.5 text-ink-soft">{s.assignedClass ?? "-"}</td>
            <td className="py-2.5"><StaffStatusBadge status={s.status} /></td>
            <td className="py-2.5 text-right text-ink-soft">›</td>
          </tr>)}</tbody>
        </table></div>)}
      </Card>
      </>}

      {selected && <div className="fixed inset-0 z-50"><div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} /><aside className="absolute right-0 top-0 h-full w-[min(440px,100%)] overflow-y-auto bg-white p-6 shadow-[0_0_60px_rgba(16,33,63,.2)] motion-safe:animate-[fade-up_.2s_ease]">
        <div className="mb-5 flex items-center justify-between"><h2 className="font-display text-[20px] font-semibold">Staff details</h2><button onClick={() => setSelected(null)} className="grid size-8 place-items-center rounded-lg text-ink-soft hover:bg-paper">✕</button></div>
        <div className="flex items-center gap-3.5"><Avatar name={selected.name} size={56} /><div><div className="font-display text-[17px] font-semibold">{selected.name}</div><div className="text-[12px] text-ink-soft">{selected.email}</div><div className="mt-0.5"><StaffStatusBadge status={selected.status} /></div></div></div>
        <dl className="mt-5 grid gap-0">{[["Staff ID", selected.staffNo ?? "-"], ["Role", roleLabel(selected.role)], ["Type", selected.teacherType], ["Assigned class", selected.assignedClass ?? "-"], ["Subjects", selected.subjects.join(", ") || "-"], ["Approve payments", selected.canApprove ? "Yes" : "No"]].map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-border-soft py-2.5 last:border-0"><dt className="text-[12px] font-bold text-ink-soft">{k}</dt><dd className="max-w-[60%] text-right text-[12px] font-bold text-ink">{k === "Staff ID" && v !== "-" ? <code className="select-all text-brand-blue">{v}</code> : v}</dd></div>)}</dl>
        {selected.role !== "school_admin" && <StaffActions staff={selected} onDone={() => { setSelected(null); router.refresh(); }} onErr={setStaffErr} />}
        {staffErr && <p className="mt-2 text-[12px] font-bold text-danger">{staffErr}</p>}
        <h3 className="mb-2 mt-6 font-display text-[15px] font-semibold">Permissions</h3>
        <div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><thead><tr className="text-[9px] uppercase tracking-wide text-ink-soft"><th className="py-1.5">Area</th>{LEVELS.map((l) => <th key={l.key} className="py-1.5 text-center font-bold">{l.label}</th>)}</tr></thead><tbody>{AREAS.map((a) => { const lvl = (selected.permissions[a] ?? "none") as Level; return <tr key={a} className="border-t border-border-soft"><td className="py-2 font-bold text-ink">{AREA_LABELS[a]}</td>{LEVELS.map((l) => <td key={l.key} className="py-2 text-center">{lvl !== "none" && rank[lvl] >= rank[l.key] ? <span className="text-brand-green">✓</span> : <span className="text-[#cdd7e6]">-</span>}</td>)}</tr>; })}</tbody></table></div>
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
            <div className="flex gap-2"><button disabled={logoBusy} onClick={() => fileRef.current?.click()} className="inline-flex min-h-9 items-center rounded-[10px] bg-brand-blue px-3.5 text-[12px] font-extrabold text-white transition hover:bg-brand-dark disabled:opacity-70">{logoBusy ? "Working…" : "Change logo"}</button>{logo && <button disabled={logoBusy} onClick={removeLogo} className="inline-flex min-h-9 items-center rounded-[10px] border border-danger-line bg-danger-soft px-3.5 text-[12px] font-extrabold text-danger transition hover:bg-danger-soft">Remove</button>}</div>
            {logoMsg && <p className="text-[11px] font-bold text-danger">{logoMsg}</p>}
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
          <div className="flex items-center gap-3"><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-brand-blue px-5 text-[13px] font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-brand-dark disabled:opacity-70">{busy ? "Saving…" : "Save changes"}</button>{msg?.ok && <span className="text-[12px] font-bold text-brand-green">Saved ✓</span>}{msg?.error && <span className="text-[12px] font-bold text-danger">{msg.error}</span>}</div>
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
            <tbody>{changes.map((ch, j) => <tr key={j} className="border-b border-border-soft last:border-0"><td className="px-2.5 py-1.5 font-bold capitalize text-ink">{ch.field}</td><td className="px-2.5 py-1.5 text-ink-soft line-through decoration-danger/40">{ch.old}</td><td className="px-2.5 py-1.5 font-bold text-brand-green">{ch.new}</td></tr>)}</tbody></table></div>
        </div>
      )}
    </div>
  );
}

/* ---------- Coming soon placeholder ---------- */
function TimetableAdmin() {
  const classes = useClassNames();
  const [cls, setCls] = useState("");
  useEffect(() => { if (!cls && classes.length) setCls(classes[0]); }, [cls, classes]);
  return (
    <div className="grid gap-[18px]">
      <Head title="Timetable" subtitle="Build each class's weekly schedule - add periods, then fill in the subject and teacher for every day." action={
        <label className="inline-flex items-center gap-2 text-[12px] font-extrabold text-ink-soft">Class
          <select value={cls} onChange={(e) => setCls(e.target.value)} className="rounded-[9px] border border-border-soft bg-white px-3 py-1.5 text-[12px] font-bold text-ink outline-none focus:border-brand-blue">
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      } />
      <Card><TimetableGrid className={cls} canEdit /></Card>
    </div>
  );
}

function ComingSoon({ name }: { name: string }) {
  return <><Head title={name} subtitle={`The ${name} module is coming soon.`} /><div className="grid place-items-center rounded-2xl border border-dashed border-border-soft bg-white py-20 text-center"><div className="mb-3 grid size-12 place-items-center rounded-xl bg-brand-soft text-brand-blue">{I(ICONS[name.toLowerCase()] ?? ICONS.reports)}</div><h2 className="font-display text-[18px] font-semibold">{name} is on the way</h2><p className="mt-1 max-w-sm text-[13px] text-ink-soft">We&rsquo;re building this module. You&rsquo;ll manage {name.toLowerCase()} right here soon.</p></div></>;
}
