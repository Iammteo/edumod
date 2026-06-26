import { DashboardChrome } from "./chrome";
import { AddStudentForm, ResetStudentPasswordForm } from "./people-forms";
import { StaffPhotoCard } from "./staff-photo";

type SchoolProps = { userName: string; schoolName: string; schoolCode: string };

type Trio = [string, string, string];

function StatGrid({ stats }: { stats: Trio[] }) {
  return <div className="my-7 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, meta]) => <div key={label} className="rounded-[14px] border border-border-soft bg-white p-[18px] transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(16,33,63,.08)]"><small className="font-bold text-ink-soft">{label}</small><strong className="mt-2 block font-display text-[28px] font-semibold leading-none">{value}</strong><span className="mt-2 block text-[10px] font-extrabold text-brand-green">{meta}</span></div>)}</div>;
}
function Panel({ id, title, action, children, className }: { id?: string; title: string; action?: string; children: React.ReactNode; className?: string }) {
  return <section id={id} className={`scroll-mt-6 rounded-2xl border border-border-soft bg-white p-5 ${className || ""}`}><div className="mb-3.5 flex items-center justify-between"><h2 className="font-display text-[18px] font-semibold">{title}</h2>{action && <a href="#" className="text-[11px] font-extrabold text-brand-blue hover:underline">{action}</a>}</div>{children}</section>;
}
function Activity({ items }: { items: Trio[] }) {
  return <>{items.map(([icon, t, m]) => <div key={t} className="flex gap-2.5 border-b border-border-soft py-2.5 last:border-0"><div className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-[12px] text-brand-blue">{icon}</div><div><strong className="block text-[11px]">{t}</strong><span className="text-[10px] text-ink-soft">{m}</span></div></div>)}</>;
}
function Rows({ items }: { items: Trio[] }) {
  return <div className="grid gap-2.5">{items.map(([a, b, c]) => <div key={a} className="flex items-center justify-between gap-3 rounded-xl border border-border-soft px-3.5 py-2.5"><div><strong className="block text-[12px]">{a}</strong><span className="text-[10px] text-ink-soft">{b}</span></div><span className="shrink-0 text-[12px] font-extrabold text-brand-blue">{c}</span></div>)}</div>;
}

/* ---------------- Admin ---------------- */
export function AdminDashboard({ userName, schoolName, schoolCode }: SchoolProps) {
  const stats: Trio[] = [["Total students", "1,248", "+28 this term"], ["Active modules", "3 / 4", "Attendance, Payments, Exams"], ["Outstanding fees", "₦3,450,000", "From 188 students"], ["Attendance today", "92%", "Present: 1,148"]];
  const modules: [string, string][] = [["Attendance", "Take attendance and track gate check-ins."], ["Payments", "View and approve payments."], ["Exams & results", "Publish results and performance records."], ["Communication", "Reach parents and staff instantly."]];
  const activity: Trio[] = [["₦", "Payment of ₦120,000 approved", "By Mrs. A. Johnson · 2 min ago"], ["◉", "David A. checked in at Gate 1", "Attendance · 18 min ago"], ["▣", "Term 2 fees published", "JSS 2A · 1 hr ago"], ["+", "New student added", "Chiamaka Nwosu · JSS 1B · 2 hrs ago"]];
  return (
    <DashboardChrome roleLabel="School Admin" school={schoolName} schoolCode={schoolCode} term="2023/2024 · Term 2" userName={userName} title={`Good morning, ${userName.split(" ")[0]} 👋`} subtitle="Here's what's happening in your school today." nav={["Overview", "Students", "Staff", "Classes", "Attendance", "Payments", "Reports", "Audit log", "Settings"]}>
      <StatGrid stats={stats} />
      <div className="grid gap-[18px] xl:grid-cols-[1.2fr_.8fr]">
        <Panel title="Your modules"><div className="grid gap-3 sm:grid-cols-2">{modules.map(([name, copy]) => <div key={name} className="rounded-xl border border-border-soft p-3.5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(16,33,63,.07)]"><strong className="block text-[12px]">{name}</strong><p className="mt-1 text-[10px] leading-[1.5] text-ink-soft">{copy}</p><a className="mt-2 block text-[11px] font-extrabold text-brand-blue" href="#">Open →</a></div>)}</div></Panel>
        <Panel title="Recent activity"><Activity items={activity} /></Panel>
      </div>
      <div className="mt-[18px] grid gap-[18px] sm:grid-cols-2">
        <Panel title="Add a student"><AddStudentForm /></Panel>
        <Panel title="Reset student password"><ResetStudentPasswordForm /></Panel>
      </div>
    </DashboardChrome>
  );
}

/* ---------------- Staff ---------------- */
type StaffProps = SchoolProps & { image: string | null; subjects: string[]; assignedClass: string | null; isClassTeacher: boolean };
export function StaffDashboard({ userName, schoolName, schoolCode, image, subjects, assignedClass, isClassTeacher }: StaffProps) {
  const stats: Trio[] = [["My subjects", String(subjects.length || 0), subjects.slice(0, 2).join(", ") || "Not assigned yet"], ["My class", assignedClass ?? "—", isClassTeacher ? "Class teacher" : "Subject teacher"], ["Attendance to take", isClassTeacher ? "1" : "0", isClassTeacher ? "Before 9:00 AM" : "Not a class teacher"], ["Results pending", "1", "Awaiting entry"]];
  const timetable: Trio[] = [["JSS 1A · Mathematics", "08:00 – 08:45 · Room 4", "Now"], ["JSS 2B · Mathematics", "09:00 – 09:45 · Room 7", "Next"], ["JSS 1B · Mathematics", "11:00 – 11:45 · Room 4", "Later"]];
  const activity: Trio[] = [["✓", "Attendance submitted", "JSS 1A · 8 min ago"], ["▣", "Scores saved as draft", "JSS 2A Maths · 1 hr ago"], ["✉", "Message sent to 24 parents", "JSS 1B · 3 hrs ago"]];
  return (
    <DashboardChrome roleLabel="Teacher" school={schoolName} schoolCode={schoolCode} term="2023/2024 · Term 2" userName={userName} title={`Hello, ${userName.split(" ")[0]} 👋`} subtitle="Here are your classes and tasks for today." nav={["Overview", "My classes", "Attendance", "Results", "Students", "Messages", "My profile"]}>
      <StatGrid stats={stats} />
      <div className="grid gap-[18px] xl:grid-cols-[1.2fr_.8fr]">
        <Panel id="my-profile" title="My profile">
          <StaffPhotoCard name={userName} image={image} />
          <dl className="mt-4 grid gap-0">{[["Role", isClassTeacher ? "Class teacher" : "Teacher"], ["Assigned class", assignedClass ?? "—"], ["Subjects", subjects.join(", ") || "—"]].map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-border-soft py-2.5 last:border-0"><dt className="text-[12px] font-bold text-ink-soft">{k}</dt><dd className="max-w-[60%] text-right text-[12px] font-bold text-ink">{v}</dd></div>)}</dl>
        </Panel>
        <Panel title="Today's timetable" action="Full timetable →"><Rows items={timetable} /></Panel>
      </div>
      <div className="mt-[18px] grid gap-[18px] xl:grid-cols-3">
        <Panel title="Recent activity"><Activity items={activity} /></Panel>
        <Panel title="Add a student"><AddStudentForm /></Panel>
        <Panel title="Reset student password"><ResetStudentPasswordForm /></Panel>
      </div>
    </DashboardChrome>
  );
}

/* ---------------- Student / Parent ---------------- */
export function StudentDashboard({ userName, schoolName, schoolCode }: SchoolProps) {
  const stats: Trio[] = [["Attendance", "96%", "This term"], ["Average score", "78%", "+4% vs last term"], ["Outstanding fees", "₦45,000", "Due 30 Apr"], ["Next class", "10:00", "Mathematics · Room 4"]];
  const results: Trio[] = [["Mathematics", "Continuous assessment", "82%"], ["English", "Continuous assessment", "75%"], ["Basic Science", "Continuous assessment", "80%"], ["Social Studies", "Continuous assessment", "71%"]];
  const fees: Trio[] = [["Term 2 tuition", "Paid · 12 Feb", "₦120,000"], ["Books & materials", "Paid · 12 Feb", "₦18,000"], ["Excursion", "Outstanding", "₦45,000"]];
  const notices: Trio[] = [["▣", "Mid-term break", "Begins 28 March · School resumes 8 April"], ["✉", "PTA meeting", "Saturday 22 March, 10:00 AM"], ["◉", "Sports day", "Friday 14 March · Main field"]];
  return (
    <DashboardChrome roleLabel="Student / Parent" school={schoolName} schoolCode={schoolCode} term="2023/2024 · Term 2" userName={userName} title={`Welcome back, ${userName.split(" ")[0]} 👋`} subtitle="Your results, attendance and fees at a glance." nav={["Overview", "Results", "Attendance", "Fees", "Timetable", "Notices", "Settings"]}>
      <StatGrid stats={stats} />
      <div className="grid gap-[18px] xl:grid-cols-[1.2fr_.8fr]">
        <Panel title="Recent results" action="View all →"><Rows items={results} /></Panel>
        <Panel title="Fees" action="Pay now →"><Rows items={fees} /></Panel>
      </div>
      <div className="mt-[18px]"><Panel title="Notices"><Activity items={notices} /></Panel></div>
    </DashboardChrome>
  );
}
