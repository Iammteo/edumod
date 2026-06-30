"use client";

import { useEffect, useState } from "react";
import { DashboardChrome } from "./chrome";
import { AddStudentForm, ResetStudentPasswordForm } from "./people-forms";
import { StaffPhotoCard } from "./staff-photo";
import { SchoolScene } from "./illustration";
import { MyAttendanceCard, RecordResults } from "./teacher-tools";
import { StudentAttendanceView } from "./student-attendance-view";
import { GreetingBanner } from "./greeting-banner";
import { CalendarCard } from "./calendar";
import { StatCard } from "./stat-card";
import { DonutChart, BarChart } from "./charts";
import { Button } from "./ui";
import { StudentProfilePage } from "./student-profile";
import { StudentNavProvider, StudentLink } from "./student-nav";
import { getStudentAttendance, getAttendanceAnalytics, type StudentAttendance, type AttendanceAnalytics } from "@/lib/actions/student-attendance";
import type { StudentOverview, StudentFee, StudentTermResult } from "@/lib/dashboard";

function WelcomeBanner({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="relative mb-1 mt-6 overflow-hidden rounded-2xl border border-border-soft bg-[linear-gradient(110deg,#eef3ff,#f6faff)] p-5 sm:p-6">
      <div className="relative z-10 max-w-[70%] sm:max-w-[62%]">
        <h2 className="font-display text-[clamp(16px,3.5vw,20px)] font-semibold leading-tight">{title}</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft sm:text-[13px]">{copy}</p>
      </div>
      <SchoolScene className="pointer-events-none absolute -right-4 -top-2 h-[120%] w-[160px] opacity-90 sm:right-2 sm:w-[200px]" />
    </div>
  );
}

type SchoolProps = { userName: string; schoolName: string; schoolCode: string };
type Trio = [string, string, string];
const naira = (n: number) => `₦${n.toLocaleString()}`;

function StatGrid({ stats }: { stats: Trio[] }) {
  return <div className="my-7 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, meta]) => <div key={label} className="rounded-[14px] border border-border-soft bg-white p-[18px] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(16,33,63,.08)]"><small className="font-bold text-ink-soft">{label}</small><strong className="mt-2 block break-words font-display text-[clamp(20px,5vw,28px)] font-semibold leading-none">{value}</strong><span className="mt-2 block text-[10px] font-extrabold text-brand-green">{meta}</span></div>)}</div>;
}
function Panel({ id, title, children, className }: { id?: string; title: string; children: React.ReactNode; className?: string }) {
  return <section id={id} className={`scroll-mt-6 rounded-2xl border border-border-soft bg-white p-5 ${className || ""}`}><div className="mb-3.5 flex items-center justify-between"><h2 className="font-display text-[18px] font-semibold">{title}</h2></div>{children}</section>;
}
function Activity({ items }: { items: Trio[] }) {
  return <>{items.map(([icon, t, m]) => <div key={t} className="flex gap-2.5 border-b border-border-soft py-2.5 last:border-0"><div className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-[12px] text-brand-blue">{icon}</div><div><strong className="block text-[11px]">{t}</strong><span className="text-[10px] text-ink-soft">{m}</span></div></div>)}</>;
}
function Empty({ text }: { text: string }) { return <div className="grid place-items-center rounded-xl border border-dashed border-border-soft py-10 text-center text-[12px] text-ink-soft">{text}</div>; }

const FEE_TONE: Record<string, string> = { paid: "bg-brand-green/10 text-brand-green", partially_paid: "bg-warn-soft text-warn", outstanding: "bg-danger-soft text-danger" };
const FEE_LABEL: Record<string, string> = { paid: "Paid", partially_paid: "Part paid", outstanding: "Outstanding" };
function FeeRows({ items }: { items: StudentFee[] }) {
  return <div className="grid gap-2.5">{items.map((f) => (
    <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-soft px-3.5 py-2.5">
      <div className="min-w-0"><div className="flex items-center gap-2"><strong className="truncate text-[12px]">{f.name}</strong><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${FEE_TONE[f.status]}`}>{FEE_LABEL[f.status]}</span></div><span className="text-[10px] text-ink-soft">Issued {f.date}{f.outstanding > 0 ? ` · ${naira(f.outstanding)} due` : ""}</span></div>
      <span className="shrink-0 text-[12px] font-extrabold text-ink">{naira(f.amount)}</span>
    </div>
  ))}</div>;
}

/* ---------------- Staff ---------------- */
type StaffProps = SchoolProps & { term: string; currentSession: string; currentTerm: string; image: string | null; subjects: string[]; assignedClass: string | null; isClassTeacher: boolean; canAddStudents: boolean; classStudents: { id: string; name: string; admissionNo: string }[] };
const STAFF_HEAD: Record<string, [string, string]> = {
  Overview: ["", ""],
  Attendance: ["Attendance", "Clock in at the terminal and mark your class register."],
  "My class": ["My class", "The pupils on your class register."],
  Results: ["Record results", "Enter CA and exam scores for your class."],
  "My profile": ["My profile", "Your role, class and subjects."],
};

const ICON_CLASS = <><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1 2 3 6 3s6-2 6-3v-5" /></>;
const ICON_USERS = <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>;
const ICON_CHECK = <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></>;
const ICON_BOOK = <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>;
const pad2 = (n: number) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

// The staff overview: admin-style stat cards plus real attendance analytics for the teacher's class.
function StaffOverview({ assignedClass, isClassTeacher, classSize, subjects }: { assignedClass: string | null; isClassTeacher: boolean; classSize: number; subjects: string[] }) {
  const canAnalyse = isClassTeacher && !!assignedClass;
  const [today, setToday] = useState<StudentAttendance | null>(null);
  const [analytics, setAnalytics] = useState<AttendanceAnalytics | null>(null);
  const [loading, setLoading] = useState(canAnalyse);
  useEffect(() => {
    if (!canAnalyse) return;
    let live = true;
    const iso = todayISO();
    Promise.all([getStudentAttendance(assignedClass!, iso), getAttendanceAnalytics(assignedClass!, iso)]).then(([t, a]) => {
      if (!live) return;
      if (!("error" in t)) setToday(t);
      setAnalytics(a);
      setLoading(false);
    });
    return () => { live = false; };
  }, [canAnalyse, assignedClass]);

  const rate = today && today.rows.length ? Math.round((today.present / today.rows.length) * 100) : 0;
  const stats = [
    { label: "My class", value: assignedClass ?? "—", icon: ICON_CLASS, color: "#2159e8", meta: isClassTeacher ? "Class teacher" : "Subject teacher" },
    { label: "Class size", value: String(classSize), icon: ICON_USERS, color: "#178a4c", meta: assignedClass ? "On the register" : "No class assigned" },
    { label: "Present today", value: canAnalyse && today ? `${today.present}/${today.rows.length}` : "—", icon: ICON_CHECK, color: "#0d8aa8", meta: canAnalyse ? `${rate}% attendance` : "Class teachers only" },
    { label: "My subjects", value: String(subjects.length), icon: ICON_BOOK, color: "#6b2fb3", meta: subjects.slice(0, 2).join(", ") || "None assigned" },
  ];
  const donut = today ? [
    { label: "Present", value: today.counts.present, color: "#178a4c" },
    { label: "Late", value: today.counts.late, color: "#c2710c" },
    { label: "Absent", value: today.counts.absent, color: "#b3261e" },
    { label: "Excused", value: today.counts.excused, color: "#6b2fb3" },
    { label: "Unmarked", value: today.counts.unmarked, color: "#cdd7e6" },
  ].filter((s) => s.value > 0) : [];

  return (
    <div className="grid gap-[18px]">
      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">{stats.map((s) => <StatCard key={s.label} {...s} />)}</div>
      {canAnalyse && (
        <div className="grid gap-[18px] lg:grid-cols-[1.3fr_1fr]">
          <Panel title="This week's attendance">
            {loading ? <Empty text="Loading…" /> : analytics && analytics.week.some((d) => d.rate > 0)
              ? <BarChart data={analytics.week.map((d) => ({ label: d.label, value: d.rate }))} yMax={100} yLabel={(n) => `${n}%`} color="#2159e8" />
              : <Empty text="No attendance marked this week yet." />}
          </Panel>
          <Panel title="Today's register">
            {loading ? <Empty text="Loading…" /> : donut.length
              ? <DonutChart total={today!.counts.total} totalLabel="Pupils" segments={donut} />
              : <Empty text="Mark today's register to see the breakdown." />}
          </Panel>
        </div>
      )}
    </div>
  );
}

export function StaffDashboard({ userName, schoolName, schoolCode, term, currentSession, currentTerm, image, subjects, assignedClass, isClassTeacher, canAddStudents, classStudents }: StaffProps) {
  const [active, setActive] = useState("Overview");
  const [addOpen, setAddOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const nav = ["Overview", "Attendance", "My class", ...(isClassTeacher ? ["Results"] : []), "My profile"];
  const [title, subtitle] = STAFF_HEAD[active] ?? ["", ""];
  const headerAction = active === "My class" && canAddStudents
    ? <Button size="sm" onClick={() => setAddOpen((v) => !v)}>{addOpen ? "Close" : "＋ Add student"}</Button>
    : undefined;
  return (
    <DashboardChrome roleLabel="Teacher" school={schoolName} schoolCode={schoolCode} term={term} userName={userName} title={title} subtitle={subtitle} nav={nav} active={active} onSelect={setActive} headerAction={profileId ? undefined : headerAction}>
      <StudentNavProvider value={{ openStudent: setProfileId }}>
      {profileId ? <StudentProfilePage studentId={profileId} onBack={() => setProfileId(null)} /> : <>
      {active === "Overview" && (
        <>
          <GreetingBanner userName={userName} subtitle={`${currentTerm} · ${currentSession} session · here’s what’s happening today.`} />
          <div className="mb-[18px] xl:hidden"><CalendarCard canManage /></div>
          <div className="grid gap-[18px] xl:grid-cols-[1fr_320px]">
            <StaffOverview assignedClass={assignedClass} isClassTeacher={isClassTeacher} classSize={classStudents.length} subjects={subjects} />
            <div className="hidden xl:block"><CalendarCard canManage /></div>
          </div>
        </>
      )}

      {active === "Attendance" && (
        <div className="grid gap-[18px]">
          <Panel title="My attendance"><MyAttendanceCard /></Panel>
          {isClassTeacher && assignedClass && <Panel title="Mark class attendance"><StudentAttendanceView embedded /></Panel>}
        </div>
      )}

      {active === "My class" && (
        <div className="grid gap-[18px]">
          {addOpen && canAddStudents && (
            <div className="grid gap-[18px] sm:grid-cols-2">
              <Panel title="Add a student"><AddStudentForm lockedClass={assignedClass ?? undefined} /></Panel>
              <Panel title="Reset student password"><ResetStudentPasswordForm /></Panel>
            </div>
          )}
          <Panel title={assignedClass ? `My class - ${assignedClass}` : "My class"}>
            {!assignedClass ? <Empty text="You haven't been assigned a class yet. Ask your admin to assign one." />
              : classStudents.length === 0 ? <Empty text={`No students are in ${assignedClass} yet.`} />
              : <div className="grid gap-1.5">{classStudents.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-soft px-3.5 py-2.5">
                    <StudentLink studentId={s.id} name={s.name} className="text-[12px] font-bold text-ink" />
                    <code className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-bold text-brand-blue">{s.admissionNo}</code>
                  </div>))}</div>}
          </Panel>
        </div>
      )}

      {active === "Results" && isClassTeacher && <Panel title="Record results"><RecordResults classStudents={classStudents} /></Panel>}

      {active === "My profile" && (
        <Panel title="My profile">
          <StaffPhotoCard name={userName} image={image} />
          <dl className="mt-4 grid gap-0">{[["Role", isClassTeacher ? "Class teacher" : "Teacher"], ["Assigned class", assignedClass ?? "-"], ["Subjects", subjects.join(", ") || "-"]].map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-border-soft py-2.5 last:border-0"><dt className="text-[12px] font-bold text-ink-soft">{k}</dt><dd className="max-w-[60%] text-right text-[12px] font-bold text-ink">{v}</dd></div>)}</dl>
        </Panel>
      )}
      </>}
      </StudentNavProvider>
    </DashboardChrome>
  );
}

/* ---------------- Student / Parent ---------------- */
type StudentProps = SchoolProps & { term: string; overview: StudentOverview };
export function StudentDashboard({ userName, schoolName, schoolCode, term, overview }: StudentProps) {
  const fees = overview?.fees ?? [];
  const stats: Trio[] = [
    ["Outstanding fees", overview ? naira(overview.outstanding) : "-", overview && overview.outstanding > 0 ? "Action needed" : "All clear ✓"],
    ["Total paid", overview ? naira(overview.paid) : "-", "Approved payments"],
    ["My class", overview?.className ?? "-", overview?.admissionNo ?? ""],
    ["Invoices", String(fees.length), fees.length ? "See below" : "None yet"],
  ];
  const results = overview?.results ?? [];
  return (
    <DashboardChrome roleLabel="Student / Parent" school={schoolName} schoolCode={schoolCode} term={term} userName={userName} title={`Welcome back, ${userName.split(" ")[0]} 👋`} subtitle="Your results, fees and payments at a glance." nav={["Overview", "Results", "Fees"]}>
      <WelcomeBanner title={`Hello, ${userName.split(" ")[0]}!`} copy={`${schoolName} · ${term}. Track your results, fees and payments here in real time.`} />
      <StatGrid stats={stats} />
      <div className="grid gap-[18px] xl:grid-cols-[1.3fr_.7fr]">
        <Panel id="results" title="My results">
          {results.length === 0 ? <Empty text="No results have been published for you yet." />
            : <div className="grid gap-4">{results.map((t) => <ResultSheet key={t.term} t={t} />)}</div>}
        </Panel>
        <Panel id="fees" title="My fees">
          {!overview ? <Empty text="No student record is linked to this account yet." /> : fees.length === 0 ? <Empty text="No fees have been issued to you yet." /> : <FeeRows items={fees} />}
        </Panel>
      </div>
    </DashboardChrome>
  );
}

const resGradeTone = (g: string) => (g === "A" ? "text-brand-green" : g === "F" ? "text-danger" : g === "D" || g === "E" ? "text-warn" : "text-brand-blue");
function ResultSheet({ t }: { t: StudentTermResult }) {
  return (
    <div className="rounded-xl border border-border-soft p-3.5">
      <div className="mb-2 flex items-center justify-between"><strong className="text-[12px]">{t.term}</strong><span className="text-[11px] font-bold text-ink-soft">Avg <strong className={resGradeTone(t.grade)}>{t.average}% · {t.grade}</strong></span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[280px] text-left text-[11px]">
        <thead><tr className="border-b border-border-soft text-[9px] uppercase tracking-wide text-ink-soft"><th className="py-1.5 font-bold">Subject</th><th className="py-1.5 text-center font-bold">CA</th><th className="py-1.5 text-center font-bold">Exam</th><th className="py-1.5 text-center font-bold">Total</th><th className="py-1.5 text-center font-bold">Grade</th></tr></thead>
        <tbody>{t.subjects.map((s) => <tr key={s.subject} className="border-b border-border-soft last:border-0"><td className="py-1.5 font-bold text-ink">{s.subject}</td><td className="py-1.5 text-center text-ink-soft">{s.ca}</td><td className="py-1.5 text-center text-ink-soft">{s.exam}</td><td className="py-1.5 text-center font-extrabold text-ink">{s.total}</td><td className={`py-1.5 text-center font-extrabold ${resGradeTone(s.grade)}`}>{s.grade}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
