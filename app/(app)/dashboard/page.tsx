import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs, memberships, schools, staffProfiles, students as studentsTable, users } from "@/db/schema";


// Turns an audit row's metadata into a specific, human-readable line (who/what/which student).
function describeAudit(action: string, m: Record<string, unknown>): string {
  const naira = (v: unknown) => `₦${Number(v || 0).toLocaleString()}`;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const cls = m.className ? ` (${str(m.className)})` : "";
  switch (action) {
    case "student.added": return `${str(m.name) || "Student"}${cls} enrolled${m.admissionNo ? ` · ${str(m.admissionNo)}` : ""}`;
    case "student.updated": return `${str(m.name) || "Student"}${cls} - profile updated`;
    case "payment.recorded": return `${naira(m.amount)} recorded for ${str(m.student) || "a student"}${m.method ? ` · ${str(m.method)}` : ""}`;
    case "payment.approved": return `${naira(m.amount)} for ${str(m.student) || "a student"} approved`;
    case "payment.rejected": return `${naira(m.amount)} for ${str(m.student) || "a student"} rejected`;
    case "fees.issued": return `${str(m.name) || "Fee"} (${naira(m.amount)}) issued to ${Number(m.issued || 0)} student${Number(m.issued) === 1 ? "" : "s"}${Array.isArray(m.classes) ? ` in ${(m.classes as string[]).join(", ")}` : ""}`;
    case "result.recorded": return `${str(m.subject) || "Result"} saved for ${str(m.student) || "a student"}${m.term ? ` · ${str(m.term)}` : ""}`;
    case "staff.invited": return `${str(m.name) || "Staff"} invited as ${str(m.role) || "staff"}`;
    case "staff.joined": return `${str(m.name) || "A staff member"} completed onboarding`;
    case "settings.updated": return "School settings updated";
    case "school.created": return `${str(m.name) || "School"} created`;
    default: return "";
  }
}
import { AdminApp } from "@/components/app/admin-app";
import { StaffDashboard, StudentDashboard } from "@/components/app/dashboards";
import { adminOverview, studentOverview } from "@/lib/dashboard";
import { roleLabel } from "@/lib/format";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const role = (session.user as { accountType?: string }).accountType ?? "student";
  const name = session.user.name || session.user.email || "there";

  const [membership] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  const school = membership ? (await db.select().from(schools).where(eq(schools.id, membership.schoolId)).limit(1))[0] : undefined;
  const schoolName = school?.name ?? "Your school";
  const termLabel = `${school?.currentSession ?? "2023/2024"} · ${school?.currentTerm ?? "Term 2"}`;
  const schoolCode = school?.schoolCode ?? "-";

  // The secretary uses the admin interface in a restricted mode (no settings/staff/finance approval).
  if (role === "admin" || membership?.role === "secretary") {
    const sid = membership?.schoolId;
    const [studentRows, staffRows, auditRows, overview] = sid
      ? await Promise.all([
          db.select().from(studentsTable).where(eq(studentsTable.schoolId, sid)).orderBy(desc(studentsTable.createdAt)).limit(200),
          db.select({ userId: users.id, name: users.name, email: users.email, staffNo: staffProfiles.staffNo, role: memberships.role, canApprove: memberships.canApprovePayments, isTeacher: staffProfiles.isTeacher, isClassTeacher: staffProfiles.isClassTeacher, assignedClass: staffProfiles.assignedClass, subjects: staffProfiles.subjects, status: staffProfiles.status, permissions: staffProfiles.permissions }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).leftJoin(staffProfiles, eq(staffProfiles.userId, memberships.userId)).where(and(eq(memberships.schoolId, sid), inArray(memberships.role, ["principal", "vice_principal", "teacher", "secretary"]))),
          db.select({ action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, createdAt: auditLogs.createdAt, actorName: users.name, actorRole: memberships.role, metadata: auditLogs.metadata }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorUserId)).leftJoin(memberships, and(eq(memberships.userId, auditLogs.actorUserId), eq(memberships.schoolId, sid))).where(eq(auditLogs.schoolId, sid)).orderBy(desc(auditLogs.createdAt)).limit(80),
          adminOverview(sid),
        ])
      : [[], [], [], { collected: 0, outstanding: 0, sections: { jss: 0, sss: 0, primary: 0, other: 0 }, series: [] }];
    return (
      <AdminApp
        userName={name}
        school={{ name: school?.name ?? schoolName, schoolCode, email: school?.email ?? null, phone: school?.phone ?? null, state: school?.state ?? null, country: school?.country ?? null, address: school?.address ?? null, logoKey: school?.logoKey ?? null, requireApproval: !!school?.requireApproval, currentSession: school?.currentSession ?? "2023/2024", currentTerm: school?.currentTerm ?? "Term 2", dayStartsAt: school?.dayStartsAt ?? null, dayEndsAt: school?.dayEndsAt ?? null }}
        students={studentRows.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`.trim(), admissionNo: s.admissionNo, createdAt: new Date(s.createdAt).toLocaleDateString(), className: s.className }))}
        staff={staffRows.map((s) => ({ userId: s.userId, name: s.name, email: s.email, staffNo: s.staffNo ?? null, role: s.role, teacherType: s.isClassTeacher ? "Class teacher" : s.isTeacher ? "Subject teacher" : (roleLabel(s.role)), subjects: (s.subjects as string[]) ?? [], assignedClass: s.assignedClass ?? null, status: s.status ?? "active", canApprove: !!s.canApprove, permissions: (s.permissions as Record<string, string>) ?? {} }))}
        audit={auditRows.map((a) => ({ action: a.action, entityType: a.entityType, entityId: a.entityId, actor: a.actorName ?? "system", actorRole: a.actorRole ? (roleLabel(a.actorRole)) : null, ts: new Date(a.createdAt).getTime(), detail: describeAudit(a.action, a.metadata as Record<string, unknown>), meta: a.metadata as Record<string, unknown> }))}
        overview={overview as Awaited<ReturnType<typeof adminOverview>>}
        restricted={role !== "admin"}
      />
    );
  }
  if (role === "staff") {
    const [sp] = membership ? await db.select().from(staffProfiles).where(eq(staffProfiles.userId, session.user.id)).limit(1) : [];
    const roster = sp?.assignedClass && membership
      ? await db.select({ id: studentsTable.id, firstName: studentsTable.firstName, lastName: studentsTable.lastName, admissionNo: studentsTable.admissionNo }).from(studentsTable).where(and(eq(studentsTable.schoolId, membership.schoolId), eq(studentsTable.className, sp.assignedClass))).orderBy(studentsTable.firstName).limit(100)
      : [];
    return <StaffDashboard userName={name} schoolName={schoolName} schoolCode={schoolCode} term={termLabel} currentSession={school?.currentSession ?? "2023/2024"} currentTerm={school?.currentTerm ?? "Term 2"} image={(session.user as { image?: string | null }).image ?? null} subjects={(sp?.subjects as string[]) ?? []} assignedClass={sp?.assignedClass ?? null} isClassTeacher={!!sp?.isClassTeacher} canAddStudents={membership?.role === "teacher" || membership?.role === "school_admin"} classStudents={roster.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`.trim(), admissionNo: s.admissionNo }))} />;
  }
  const overview = await studentOverview(session.user.id);
  return <StudentDashboard userName={name} schoolName={schoolName} schoolCode={schoolCode} term={termLabel} overview={overview} />;
}
