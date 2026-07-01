"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/context";
import { timetablePeriods, timetableSlots, memberships, users, staffProfiles } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { TIMETABLE_DAYS } from "@/lib/timetable-days";

export type TimetableSlot = { subject: string | null; teacher: string | null; room: string | null };
export type TimetablePeriod = {
  id: string; startTime: string; endTime: string; label: string | null; isBreak: boolean;
  slots: (TimetableSlot | null)[]; // one per day, index-aligned with TIMETABLE_DAYS
};
export type Timetable = { className: string; periods: TimetablePeriod[] };

async function ctx() {
  const a = await getAuthContext();
  if (!a) return null;
  // Same leadership set that manages classes may edit timetables. Teachers/students read only.
  return { userId: a.userId, schoolId: a.schoolId, role: a.role, canManage: ["school_admin", "principal", "vice_principal", "secretary"].includes(a.role) };
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const cleanTime = (v: string) => v.trim();
const cleanName = (v: string) => v.trim().replace(/\s+/g, " ");

// Read a class's weekly timetable. Open to any member (everyone can view their school's schedule).
export async function getTimetable(className: string): Promise<Timetable> {
  const c = await ctx();
  const cn = cleanName(className);
  if (!c || !cn) return { className: cn, periods: [] };
  const periods = await db.select().from(timetablePeriods)
    .where(and(eq(timetablePeriods.schoolId, c.schoolId), eq(timetablePeriods.className, cn)));
  if (periods.length === 0) return { className: cn, periods: [] };
  const slots = await db.select().from(timetableSlots).where(inArray(timetableSlots.periodId, periods.map((p) => p.id)));
  const byPeriod = new Map<string, typeof slots>();
  for (const s of slots) (byPeriod.get(s.periodId) ?? byPeriod.set(s.periodId, []).get(s.periodId)!).push(s);
  const rows = periods
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.idx - b.idx)
    .map((p) => {
      const mine = byPeriod.get(p.id) ?? [];
      const slotsByDay: (TimetableSlot | null)[] = TIMETABLE_DAYS.map((_, day) => {
        const s = mine.find((x) => x.day === day);
        return s ? { subject: s.subject, teacher: s.teacher, room: s.room } : null;
      });
      return { id: p.id, startTime: p.startTime, endTime: p.endTime, label: p.label, isBreak: p.isBreak, slots: slotsByDay };
    });
  return { className: cn, periods: rows };
}

// Teacher / subject-teacher names for the slot picker's datalist.
export async function listTeacherNames(): Promise<string[]> {
  const c = await ctx();
  if (!c) return [];
  const rows = await db.select({ name: users.name }).from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(staffProfiles, eq(staffProfiles.userId, memberships.userId))
    .where(and(eq(memberships.schoolId, c.schoolId), inArray(memberships.role, ["teacher", "principal", "vice_principal"])));
  return [...new Set(rows.map((r) => r.name).filter(Boolean))].sort();
}

export async function addPeriod(input: { className: string; startTime: string; endTime: string; label?: string; isBreak?: boolean }): Promise<{ ok: true; id: string } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to edit the timetable." };
  const className = cleanName(input.className);
  const startTime = cleanTime(input.startTime), endTime = cleanTime(input.endTime);
  if (!className) return { error: "Pick a class first." };
  if (!HHMM.test(startTime) || !HHMM.test(endTime)) return { error: "Enter valid times (HH:MM)." };
  if (endTime <= startTime) return { error: "End time must be after the start time." };
  const label = input.label?.trim().slice(0, 80) || null;
  try {
    const existing = await db.select({ idx: timetablePeriods.idx }).from(timetablePeriods)
      .where(and(eq(timetablePeriods.schoolId, c.schoolId), eq(timetablePeriods.className, className)));
    const nextIdx = existing.reduce((m, r) => Math.max(m, r.idx), -1) + 1;
    const [row] = await db.insert(timetablePeriods)
      .values({ schoolId: c.schoolId, className, idx: nextIdx, startTime, endTime, label, isBreak: !!input.isBreak })
      .returning({ id: timetablePeriods.id });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "timetable.period_added", entityType: "Timetable", metadata: { className, startTime, endTime } });
    return { ok: true, id: row.id };
  } catch {
    return { error: "Could not add that period. Please try again." };
  }
}

export async function updatePeriod(input: { id: string; startTime: string; endTime: string; label?: string; isBreak?: boolean }): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to edit the timetable." };
  const startTime = cleanTime(input.startTime), endTime = cleanTime(input.endTime);
  if (!HHMM.test(startTime) || !HHMM.test(endTime)) return { error: "Enter valid times (HH:MM)." };
  if (endTime <= startTime) return { error: "End time must be after the start time." };
  try {
    const r = await db.update(timetablePeriods)
      .set({ startTime, endTime, label: input.label?.trim().slice(0, 80) || null, isBreak: !!input.isBreak, updatedAt: new Date() })
      .where(and(eq(timetablePeriods.id, input.id), eq(timetablePeriods.schoolId, c.schoolId)))
      .returning({ id: timetablePeriods.id });
    if (r.length === 0) return { error: "That period no longer exists." };
    return { ok: true };
  } catch {
    return { error: "Could not update that period. Please try again." };
  }
}

export async function deletePeriod(id: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to edit the timetable." };
  try {
    await db.delete(timetablePeriods).where(and(eq(timetablePeriods.id, id), eq(timetablePeriods.schoolId, c.schoolId)));
    return { ok: true };
  } catch {
    return { error: "Could not remove that period. Please try again." };
  }
}

// Upsert one cell. Clearing every field removes the row so the grid stays sparse.
export async function setSlot(input: { periodId: string; day: number; subject?: string; teacher?: string; room?: string }): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to edit the timetable." };
  if (!Number.isInteger(input.day) || input.day < 0 || input.day >= TIMETABLE_DAYS.length) return { error: "Invalid day." };
  const subject = input.subject?.trim().slice(0, 120) || null;
  const teacher = input.teacher?.trim().slice(0, 120) || null;
  const room = input.room?.trim().slice(0, 60) || null;
  try {
    // Confirm the period belongs to this school before touching its slots.
    const [p] = await db.select({ id: timetablePeriods.id }).from(timetablePeriods)
      .where(and(eq(timetablePeriods.id, input.periodId), eq(timetablePeriods.schoolId, c.schoolId))).limit(1);
    if (!p) return { error: "That period no longer exists." };
    if (!subject && !teacher && !room) {
      await db.delete(timetableSlots).where(and(eq(timetableSlots.periodId, input.periodId), eq(timetableSlots.day, input.day)));
      return { ok: true };
    }
    await db.insert(timetableSlots).values({ schoolId: c.schoolId, periodId: input.periodId, day: input.day, subject, teacher, room })
      .onConflictDoUpdate({ target: [timetableSlots.periodId, timetableSlots.day], set: { subject, teacher, room, updatedAt: new Date() } });
    return { ok: true };
  } catch {
    return { error: "Could not save that. Please try again." };
  }
}
