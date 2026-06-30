"use server";

import { headers } from "next/headers";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs, memberships, staffProfiles, students, studentAttendance, users } from "@/db/schema";
import { logAudit } from "@/lib/audit";

type Status = "present" | "absent" | "late" | "excused";
const VALID: Status[] = ["present", "absent", "late", "excused"];

async function ctx() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, s.user.id)).limit(1);
  if (!m) return null;
  const isAdmin = ["school_admin", "principal", "vice_principal"].includes(m.role);
  const [sp] = await db.select({ assignedClass: staffProfiles.assignedClass, isClassTeacher: staffProfiles.isClassTeacher }).from(staffProfiles).where(eq(staffProfiles.userId, s.user.id)).limit(1);
  return { userId: s.user.id, schoolId: m.schoolId, role: m.role, isAdmin, assignedClass: sp?.assignedClass ?? null, isClassTeacher: !!sp?.isClassTeacher };
}

function canMark(c: NonNullable<Awaited<ReturnType<typeof ctx>>>, className: string) {
  return c.isAdmin || (c.assignedClass === className && className.length > 0);
}

export type MarkableClass = { className: string; mine: boolean };
export async function getMarkableClasses(): Promise<MarkableClass[]> {
  const c = await ctx();
  if (!c) return [];
  if (c.isAdmin) {
    const rows = await db.select({ cn: students.className }).from(students).where(eq(students.schoolId, c.schoolId)).groupBy(students.className);
    return rows.filter((r) => r.cn).map((r) => ({ className: r.cn as string, mine: r.cn === c.assignedClass })).sort((a, b) => a.className.localeCompare(b.className));
  }
  return c.assignedClass ? [{ className: c.assignedClass, mine: true }] : [];
}

export type AttnRow = { id: string; name: string; admissionNo: string; guardianPhone: string | null; status: Status | null };
export type AttnCounts = { total: number; present: number; absent: number; late: number; excused: number; unmarked: number };
export type ClassTeacher = { name: string; email: string | null } | null;
export type StudentAttendance = { canMark: boolean; rows: AttnRow[]; counts: AttnCounts; teacher: ClassTeacher; present: number; absent: number; marked: number };
export async function getStudentAttendance(className: string, date: string): Promise<StudentAttendance | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid date." };
  const [roster, marks, teacherRow] = await Promise.all([
    db.select({ id: students.id, fn: students.firstName, ln: students.lastName, admissionNo: students.admissionNo, phone: students.guardianPhone }).from(students).where(and(eq(students.schoolId, c.schoolId), eq(students.className, className))).orderBy(students.firstName),
    db.select({ studentId: studentAttendance.studentId, status: studentAttendance.status }).from(studentAttendance).where(and(eq(studentAttendance.schoolId, c.schoolId), eq(studentAttendance.attendanceDate, date))),
    db.select({ name: users.name, email: users.email }).from(staffProfiles).innerJoin(users, eq(users.id, staffProfiles.userId)).where(and(eq(staffProfiles.schoolId, c.schoolId), eq(staffProfiles.assignedClass, className), eq(staffProfiles.isClassTeacher, true))).limit(1),
  ]);
  const map = new Map(marks.map((m) => [m.studentId, m.status as Status]));
  const rows: AttnRow[] = roster.map((s) => ({ id: s.id, name: `${s.fn} ${s.ln}`.trim(), admissionNo: s.admissionNo, guardianPhone: s.phone, status: map.get(s.id) ?? null }));
  const n = (st: Status) => rows.filter((r) => r.status === st).length;
  const counts: AttnCounts = { total: rows.length, present: n("present"), absent: n("absent"), late: n("late"), excused: n("excused"), unmarked: rows.filter((r) => !r.status).length };
  return { canMark: canMark(c, className), rows, counts, teacher: teacherRow[0] ?? null, present: counts.present + counts.late, absent: counts.absent, marked: rows.filter((r) => r.status).length };
}

// Right-rail analytics for the attendance dashboard: per-class rates today, this week's trend for the
// selected class, and recent attendance activity.
function mondayToFriday(dateStr: string): { label: string; iso: string }[] {
  const d = new Date(dateStr + "T00:00"); const dow = (d.getDay() + 6) % 7; const mon = new Date(d.getTime() - dow * 864e5);
  return ["Mon", "Tue", "Wed", "Thu", "Fri"].map((label, i) => { const x = new Date(mon.getTime() + i * 864e5); return { label, iso: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}` }; });
}
export type ClassRate = { className: string; rate: number; present: number; total: number };
export type DayRate = { label: string; rate: number };
export type ActivityItem = { text: string; time: string; kind: "marked" | "cleared" };
export type AttendanceAnalytics = { byClass: ClassRate[]; week: DayRate[]; recent: ActivityItem[] };
export async function getAttendanceAnalytics(className: string, date: string): Promise<AttendanceAnalytics> {
  const c = await ctx();
  if (!c) return { byClass: [], week: [], recent: [] };
  const days = mondayToFriday(date);
  // Non-admins only see their own class's rates (a class teacher shouldn't see every class's numbers).
  const limitToClass = !c.isAdmin;
  const myClass = c.assignedClass;
  if (limitToClass && !myClass) return { byClass: [], week: [], recent: [] }; // a teacher with no class has nothing to show
  const rosterWhere = limitToClass ? and(eq(students.schoolId, c.schoolId), eq(students.className, myClass!)) : eq(students.schoolId, c.schoolId);
  const dayWhere = limitToClass ? and(eq(studentAttendance.schoolId, c.schoolId), eq(studentAttendance.attendanceDate, date), eq(studentAttendance.className, myClass!)) : and(eq(studentAttendance.schoolId, c.schoolId), eq(studentAttendance.attendanceDate, date));
  const [rosterCounts, dayMarks, weekMarks, recentRows] = await Promise.all([
    db.select({ cn: students.className, n: sql<number>`count(*)::int` }).from(students).where(rosterWhere).groupBy(students.className),
    db.select({ cn: studentAttendance.className, status: studentAttendance.status }).from(studentAttendance).where(dayWhere),
    db.select({ d: studentAttendance.attendanceDate, status: studentAttendance.status }).from(studentAttendance).where(and(eq(studentAttendance.schoolId, c.schoolId), eq(studentAttendance.className, className), gte(studentAttendance.attendanceDate, days[0].iso), lte(studentAttendance.attendanceDate, days[days.length - 1].iso))),
    db.select({ action: auditLogs.action, meta: auditLogs.metadata, createdAt: auditLogs.createdAt, actor: users.name }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorUserId)).where(and(eq(auditLogs.schoolId, c.schoolId), inArray(auditLogs.action, ["attendance.class_marked", "attendance.class_cleared"]))).orderBy(desc(auditLogs.createdAt)).limit(6),
  ]);
  const totalByClass = new Map(rosterCounts.filter((r) => r.cn).map((r) => [r.cn as string, r.n]));
  const presentByClass = new Map<string, number>();
  for (const m of dayMarks) if (m.cn && m.status === "present") presentByClass.set(m.cn, (presentByClass.get(m.cn) ?? 0) + 1);
  const byClass: ClassRate[] = [...totalByClass.entries()].map(([cn, total]) => { const present = presentByClass.get(cn) ?? 0; return { className: cn, total, present, rate: total ? Math.round((present / total) * 100) : 0 }; }).sort((a, b) => a.className.localeCompare(b.className));
  const classTotal = totalByClass.get(className) ?? 0;
  const presentByDay = new Map<string, number>();
  for (const m of weekMarks) if (m.status === "present") presentByDay.set(m.d as string, (presentByDay.get(m.d as string) ?? 0) + 1);
  const week: DayRate[] = days.map((d) => ({ label: d.label, rate: classTotal ? Math.round(((presentByDay.get(d.iso) ?? 0) / classTotal) * 100) : 0 }));
  const recent: ActivityItem[] = recentRows
    .filter((r) => c.isAdmin || ((r.meta ?? {}) as { className?: string }).className === c.assignedClass)
    .map((r) => {
      const meta = (r.meta ?? {}) as { className?: string };
      const cleared = r.action === "attendance.class_cleared";
      return { text: `${meta.className ?? "A class"} attendance ${cleared ? "cleared" : "marked"}${r.actor ? ` by ${r.actor}` : ""}`, time: new Date(r.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), kind: cleared ? "cleared" : "marked" };
    });
  return { byClass, week, recent };
}

// Printable student register for a class, by day or week.
const STATUS_LABEL: Record<string, string> = { present: "Present", absent: "Absent", late: "Late", excused: "Not required" };
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export type StudentAttnReportRow = { date: string; name: string; admissionNo: string; className: string; status: string };
// Pass className === "__all__" for the whole-school scope (admin only). The client mirrors this
// value as ALL_CLASSES - a "use server" file may only export async functions, so it can't live here.
export async function getStudentAttendanceReport(className: string, from: string, to: string): Promise<StudentAttnReportRow[] | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  const all = className === "__all__";
  if (all && !c.isAdmin) return { error: "Only an admin can export all classes." };
  if (!all && !canMark(c, className) && !c.isAdmin) return { error: "You can only export your own class." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: "Invalid date range." };
  const rosterWhere = all ? eq(students.schoolId, c.schoolId) : and(eq(students.schoolId, c.schoolId), eq(students.className, className));
  const [roster, marks] = await Promise.all([
    db.select({ id: students.id, fn: students.firstName, ln: students.lastName, admissionNo: students.admissionNo, cn: students.className }).from(students).where(rosterWhere).orderBy(students.className, students.firstName),
    db.select({ studentId: studentAttendance.studentId, date: studentAttendance.attendanceDate, status: studentAttendance.status }).from(studentAttendance).where(and(eq(studentAttendance.schoolId, c.schoolId), gte(studentAttendance.attendanceDate, from), lte(studentAttendance.attendanceDate, to))),
  ]);
  const markMap = new Map(marks.map((m) => [`${m.studentId}|${m.date}`, m.status as string]));
  const days: string[] = []; let d = new Date(from + "T00:00"); const end = new Date(to + "T00:00");
  for (let i = 0; i < 40 && d <= end; i++) { days.push(isoDay(d)); d = new Date(d.getTime() + 864e5); }
  const rows: StudentAttnReportRow[] = [];
  for (const day of days) for (const s of roster) {
    const st = markMap.get(`${s.id}|${day}`);
    rows.push({ date: day, name: `${s.fn} ${s.ln}`.trim(), admissionNo: s.admissionNo, className: s.cn ?? "-", status: st ? (STATUS_LABEL[st] ?? st) : "-" });
  }
  return rows;
}

export async function markStudentAttendance(input: { studentId: string; className: string; date: string; status: Status }): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (!VALID.includes(input.status)) return { error: "Invalid status." };
  if (!canMark(c, input.className)) return { error: "You can only mark your own class." };
  const [stu] = await db.select({ id: students.id }).from(students).where(and(eq(students.id, input.studentId), eq(students.schoolId, c.schoolId))).limit(1);
  if (!stu) return { error: "Student not found." };
  try {
    await db.insert(studentAttendance).values({ schoolId: c.schoolId, studentId: input.studentId, className: input.className, attendanceDate: input.date, status: input.status, markedByUserId: c.userId })
      .onConflictDoUpdate({ target: [studentAttendance.studentId, studentAttendance.attendanceDate], set: { status: input.status, markedByUserId: c.userId, className: input.className, updatedAt: new Date() } });
    return { ok: true };
  } catch {
    return { error: "Could not save. Please try again." };
  }
}

// Bulk action for the whole class on a day:
//   present / absent / excused ("not required") → set every student to that status (overwrites)
//   clear → remove all marks for the day
// "Mark all present, except…" = tap "All present" then flip the few exceptions individually.
export async function bulkMarkClass(input: { className: string; date: string; mode: "present" | "absent" | "excused" | "clear" }): Promise<{ ok: true; count: number } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (!["present", "absent", "excused", "clear"].includes(input.mode)) return { error: "Invalid action." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Invalid date." };
  if (!canMark(c, input.className)) return { error: "You can only mark your own class." };
  const roster = await db.select({ id: students.id }).from(students).where(and(eq(students.schoolId, c.schoolId), eq(students.className, input.className)));
  if (roster.length === 0) return { ok: true, count: 0 };
  const ids = roster.map((r) => r.id);
  try {
    if (input.mode === "clear") {
      await db.delete(studentAttendance).where(and(eq(studentAttendance.attendanceDate, input.date), inArray(studentAttendance.studentId, ids)));
      await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "attendance.class_cleared", entityType: "Attendance", metadata: { className: input.className, date: input.date } });
      return { ok: true, count: 0 };
    }
    const status = input.mode;
    await db.insert(studentAttendance).values(ids.map((id) => ({ schoolId: c.schoolId, studentId: id, className: input.className, attendanceDate: input.date, status, markedByUserId: c.userId })))
      .onConflictDoUpdate({ target: [studentAttendance.studentId, studentAttendance.attendanceDate], set: { status, markedByUserId: c.userId, className: input.className, updatedAt: new Date() } });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "attendance.class_marked", entityType: "Attendance", metadata: { className: input.className, date: input.date, status, count: ids.length } });
    return { ok: true, count: ids.length };
  } catch {
    return { error: "Could not apply the bulk action. Please try again." };
  }
}
