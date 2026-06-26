import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs, memberships, schools, staffProfiles, students as studentsTable, users } from "@/db/schema";

const ROLE_LABEL: Record<string, string> = { principal: "Principal", vice_principal: "Vice principal", teacher: "Teacher", bursar: "Bursar" };
import { AdminApp } from "@/components/app/admin-app";
import { StaffDashboard, StudentDashboard } from "@/components/app/dashboards";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const role = (session.user as { accountType?: string }).accountType ?? "student";
  const name = session.user.name || session.user.email || "there";

  const [membership] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  const school = membership ? (await db.select().from(schools).where(eq(schools.id, membership.schoolId)).limit(1))[0] : undefined;
  const schoolName = school?.name ?? "Your school";
  const schoolCode = school?.schoolCode ?? "—";

  if (role === "admin") {
    const sid = membership?.schoolId;
    const [studentRows, staffRows, auditRows] = sid
      ? await Promise.all([
          db.select().from(studentsTable).where(eq(studentsTable.schoolId, sid)).orderBy(desc(studentsTable.createdAt)).limit(200),
          db.select({ name: users.name, email: users.email, role: memberships.role, canApprove: memberships.canApprovePayments, isTeacher: staffProfiles.isTeacher, isClassTeacher: staffProfiles.isClassTeacher, assignedClass: staffProfiles.assignedClass, subjects: staffProfiles.subjects, status: staffProfiles.status, permissions: staffProfiles.permissions }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).leftJoin(staffProfiles, eq(staffProfiles.userId, memberships.userId)).where(and(eq(memberships.schoolId, sid), inArray(memberships.role, ["principal", "vice_principal", "teacher", "bursar"]))),
          db.select().from(auditLogs).where(eq(auditLogs.schoolId, sid)).orderBy(desc(auditLogs.createdAt)).limit(50),
        ])
      : [[], [], []];
    return (
      <AdminApp
        userName={name}
        school={{ name: school?.name ?? schoolName, schoolCode, email: school?.email ?? null, phone: school?.phone ?? null, state: school?.state ?? null, country: school?.country ?? null, address: school?.address ?? null, logoKey: school?.logoKey ?? null }}
        students={studentRows.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`.trim(), admissionNo: s.admissionNo, createdAt: new Date(s.createdAt).toLocaleDateString() }))}
        staff={staffRows.map((s) => ({ name: s.name, email: s.email, role: s.role, teacherType: s.isClassTeacher ? "Class teacher" : s.isTeacher ? "Subject teacher" : (ROLE_LABEL[s.role] ?? "Staff"), subjects: (s.subjects as string[]) ?? [], assignedClass: s.assignedClass ?? null, status: s.status ?? "active", canApprove: !!s.canApprove, permissions: (s.permissions as Record<string, string>) ?? {} }))}
        audit={auditRows.map((a) => ({ action: a.action, entityType: a.entityType, actor: a.actorUserId, at: new Date(a.createdAt).toLocaleDateString() }))}
      />
    );
  }
  if (role === "staff") {
    const [sp] = membership ? await db.select().from(staffProfiles).where(eq(staffProfiles.userId, session.user.id)).limit(1) : [];
    return <StaffDashboard userName={name} schoolName={schoolName} schoolCode={schoolCode} image={(session.user as { image?: string | null }).image ?? null} subjects={(sp?.subjects as string[]) ?? []} assignedClass={sp?.assignedClass ?? null} isClassTeacher={!!sp?.isClassTeacher} />;
  }
  return <StudentDashboard userName={name} schoolName={schoolName} schoolCode={schoolCode} />;
}
