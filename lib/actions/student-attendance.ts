"use server";

import { headers } from "next/headers";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, staffProfiles, students, studentAttendance } from "@/db/schema";
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

export type AttnRow = { id: string; name: string; admissionNo: string; status: Status | null };
export type StudentAttendance = { canMark: boolean; rows: AttnRow[]; present: number; absent: number; marked: number };
export async function getStudentAttendance(className: string, date: string): Promise<StudentAttendance | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid date." };
  const [roster, marks] = await Promise.all([
    db.select({ id: students.id, fn: students.firstName, ln: students.lastName, admissionNo: students.admissionNo }).from(students).where(and(eq(students.schoolId, c.schoolId), eq(students.className, className))).orderBy(students.firstName),
    db.select({ studentId: studentAttendance.studentId, status: studentAttendance.status }).from(studentAttendance).where(and(eq(studentAttendance.schoolId, c.schoolId), eq(studentAttendance.attendanceDate, date))),
  ]);
  const map = new Map(marks.map((m) => [m.studentId, m.status as Status]));
  const rows: AttnRow[] = roster.map((s) => ({ id: s.id, name: `${s.fn} ${s.ln}`.trim(), admissionNo: s.admissionNo, status: map.get(s.id) ?? null }));
  return { canMark: canMark(c, className), rows, present: rows.filter((r) => r.status === "present" || r.status === "late").length, absent: rows.filter((r) => r.status === "absent").length, marked: rows.filter((r) => r.status).length };
}

// Printable student register for a class, by day or week.
const STATUS_LABEL: Record<string, string> = { present: "Present", absent: "Absent", late: "Late", excused: "Not required" };
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export type StudentAttnReportRow = { date: string; name: string; admissionNo: string; className: string; status: string };
// Pass className === "__all__" for the whole-school scope (admin only). The client mirrors this
// value as ALL_CLASSES — a "use server" file may only export async functions, so it can't live here.
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
    rows.push({ date: day, name: `${s.fn} ${s.ln}`.trim(), admissionNo: s.admissionNo, className: s.cn ?? "—", status: st ? (STATUS_LABEL[st] ?? st) : "—" });
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
