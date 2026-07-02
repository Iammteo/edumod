"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/context";
import { timetablePeriods, timetableSlots, timetableMeta, memberships, users } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { TIMETABLE_DAYS } from "@/lib/timetable-days";

export type TimetableSlot = { subject: string | null; teacher?: string | null; room?: string | null };
export type TimetablePeriod = {
  id: string; startTime: string; endTime: string; label: string | null; isBreak: boolean;
  slots: (TimetableSlot | null)[]; // one per day, index-aligned with TIMETABLE_DAYS
};
export type Timetable = { className: string; title: string; periods: TimetablePeriod[] };

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
  if (!c || !cn) return { className: cn, title: "", periods: [] };
  const [periods, [meta]] = await Promise.all([
    db.select().from(timetablePeriods).where(and(eq(timetablePeriods.schoolId, c.schoolId), eq(timetablePeriods.className, cn))),
    db.select({ title: timetableMeta.title }).from(timetableMeta).where(and(eq(timetableMeta.schoolId, c.schoolId), eq(timetableMeta.className, cn))).limit(1),
  ]);
  const title = meta?.title ?? "";
  if (periods.length === 0) return { className: cn, title, periods: [] };
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
  return { className: cn, title, periods: rows };
}

// Set (or clear) the custom heading shown above a class's timetable.
export async function setTimetableTitle(input: { className: string; title: string }): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to edit the timetable." };
  const className = cleanName(input.className);
  if (!className) return { error: "Pick a class first." };
  const title = input.title.trim().slice(0, 160) || null;
  try {
    await db.insert(timetableMeta).values({ schoolId: c.schoolId, className, title })
      .onConflictDoUpdate({ target: [timetableMeta.schoolId, timetableMeta.className], set: { title, updatedAt: new Date() } });
    return { ok: true };
  } catch {
    return { error: "Could not save the title. Please try again." };
  }
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

// Teacher / leadership names for the builder's teacher datalist.
export async function listTeacherNames(): Promise<string[]> {
  const c = await ctx();
  if (!c) return [];
  const rows = await db.select({ name: users.name }).from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.schoolId, c.schoolId), inArray(memberships.role, ["teacher", "principal", "vice_principal"])));
  return [...new Set(rows.map((r) => r.name).filter(Boolean))].sort();
}

// Upsert one cell (subject/teacher/room). Clearing all three removes the row so the grid stays sparse.
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

/* ---------------- Analytics (Overview, Teacher schedules, Rooms & conflicts) ---------------- */
export type SlotEntry = { day: number; className: string; subject: string | null; teacher: string | null; room: string | null; startTime: string; endTime: string };
export type Clash = { day: number; startTime: string; endTime: string; name: string; entries: { className: string; subject: string | null }[] };

// Every filled lesson slot in the school, joined to its period's time. The building block for the
// teacher-schedule, room-usage and conflict views (all derived from the class timetables themselves).
async function allLessonSlots(schoolId: string): Promise<SlotEntry[]> {
  const rows = await db.select({
    day: timetableSlots.day, subject: timetableSlots.subject, teacher: timetableSlots.teacher, room: timetableSlots.room,
    className: timetablePeriods.className, startTime: timetablePeriods.startTime, endTime: timetablePeriods.endTime, isBreak: timetablePeriods.isBreak,
  }).from(timetableSlots).innerJoin(timetablePeriods, eq(timetablePeriods.id, timetableSlots.periodId))
    .where(eq(timetableSlots.schoolId, schoolId));
  return rows.filter((r) => !r.isBreak).map(({ isBreak: _omit, ...r }) => r);
}

function findClashes(rows: SlotEntry[], key: "teacher" | "room"): Clash[] {
  const map = new Map<string, Clash>();
  for (const r of rows) {
    const v = r[key]; if (!v) continue;
    const k = `${r.day}|${r.startTime}|${r.endTime}|${v.toLowerCase()}`;
    let c = map.get(k);
    if (!c) { c = { day: r.day, startTime: r.startTime, endTime: r.endTime, name: v, entries: [] }; map.set(k, c); }
    c.entries.push({ className: r.className, subject: r.subject });
  }
  return [...map.values()].filter((c) => c.entries.length > 1).sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime));
}

export async function getTimetableAnalytics(): Promise<{ classesWithTimetable: number; lessons: number; teachers: string[]; rooms: string[]; clashes: { teacher: Clash[]; room: Clash[] } }> {
  const c = await ctx();
  if (!c) return { classesWithTimetable: 0, lessons: 0, teachers: [], rooms: [], clashes: { teacher: [], room: [] } };
  const [rows, periodClasses] = await Promise.all([
    allLessonSlots(c.schoolId),
    db.selectDistinct({ className: timetablePeriods.className }).from(timetablePeriods).where(eq(timetablePeriods.schoolId, c.schoolId)),
  ]);
  const teachers = [...new Set(rows.map((r) => r.teacher).filter((x): x is string => !!x))].sort();
  const rooms = [...new Set(rows.map((r) => r.room).filter((x): x is string => !!x))].sort();
  return {
    classesWithTimetable: periodClasses.length,
    lessons: rows.filter((r) => r.subject).length,
    teachers, rooms,
    clashes: { teacher: findClashes(rows, "teacher"), room: findClashes(rows, "room") },
  };
}

// A single teacher's week across every class, plus workload stats.
export async function getTeacherSchedule(teacher: string): Promise<{ entries: SlotEntry[]; periods: number; classes: number; subjects: string[] }> {
  const c = await ctx();
  const name = cleanName(teacher);
  if (!c || !name) return { entries: [], periods: 0, classes: 0, subjects: [] };
  const rows = (await allLessonSlots(c.schoolId)).filter((r) => (r.teacher ?? "").toLowerCase() === name.toLowerCase());
  return {
    entries: rows,
    periods: rows.length,
    classes: new Set(rows.map((r) => r.className)).size,
    subjects: [...new Set(rows.map((r) => r.subject).filter((x): x is string => !!x))].sort(),
  };
}

// Copy one class's whole timetable (periods, breaks and subjects) onto other classes, REPLACING each
// target's current timetable. Titles aren't copied - they usually name the class. Leadership only.
export async function copyTimetableTo(input: { fromClass: string; toClasses: string[] }): Promise<{ ok: true; count: number } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to edit the timetable." };
  const from = cleanName(input.fromClass);
  const targets = [...new Set((input.toClasses || []).map(cleanName).filter((n) => n && n !== from))];
  if (!from) return { error: "Pick a class first." };
  if (targets.length === 0) return { error: "Pick at least one other class to copy to." };

  const srcPeriods = await db.select().from(timetablePeriods).where(and(eq(timetablePeriods.schoolId, c.schoolId), eq(timetablePeriods.className, from)));
  if (srcPeriods.length === 0) return { error: "Build this class's timetable before copying it." };
  const srcSlots = await db.select().from(timetableSlots).where(inArray(timetableSlots.periodId, srcPeriods.map((p) => p.id)));
  const slotsByPeriod = new Map<string, typeof srcSlots>();
  for (const s of srcSlots) (slotsByPeriod.get(s.periodId) ?? slotsByPeriod.set(s.periodId, []).get(s.periodId)!).push(s);

  try {
    await db.transaction(async (tx) => {
      for (const target of targets) {
        await tx.delete(timetablePeriods).where(and(eq(timetablePeriods.schoolId, c.schoolId), eq(timetablePeriods.className, target)));
        for (const p of srcPeriods) {
          const [np] = await tx.insert(timetablePeriods)
            .values({ schoolId: c.schoolId, className: target, idx: p.idx, startTime: p.startTime, endTime: p.endTime, label: p.label, isBreak: p.isBreak })
            .returning({ id: timetablePeriods.id });
          const slots = slotsByPeriod.get(p.id) ?? [];
          if (slots.length) await tx.insert(timetableSlots).values(slots.map((s) => ({ schoolId: c.schoolId, periodId: np.id, day: s.day, subject: s.subject, teacher: s.teacher, room: s.room })));
        }
      }
    });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "timetable.copied", entityType: "Timetable", metadata: { from, to: targets } });
    return { ok: true, count: targets.length };
  } catch {
    return { error: "Could not copy the timetable. Please try again." };
  }
}
