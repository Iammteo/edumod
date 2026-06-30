"use server";

import { headers } from "next/headers";
import { and, asc, eq, gte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, schoolEvents } from "@/db/schema";
import { logAudit } from "@/lib/audit";

async function ctx() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (!m) return null;
  const canManage = ["school_admin", "principal", "vice_principal", "secretary", "teacher"].includes(m.role);
  return { userId: session.user.id, schoolId: m.schoolId, role: m.role, canManage };
}

export type SchoolEvent = { id: string; date: string; title: string; kind: string };

export async function getEvents(): Promise<SchoolEvent[]> {
  const c = await ctx();
  if (!c) return [];
  const since = new Date();
  since.setMonth(since.getMonth() - 1, 1);
  const rows = await db.select({ id: schoolEvents.id, eventDate: schoolEvents.eventDate, title: schoolEvents.title, kind: schoolEvents.kind })
    .from(schoolEvents).where(and(eq(schoolEvents.schoolId, c.schoolId), gte(schoolEvents.eventDate, since.toISOString().slice(0, 10)))).orderBy(asc(schoolEvents.eventDate)).limit(200);
  return rows.map((r) => ({ id: r.id, date: r.eventDate as string, title: r.title, kind: r.kind }));
}

export async function addEvent(input: { date: string; title: string; kind?: string }): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission to add events." };
  const date = input.date?.trim();
  const title = input.title?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a valid date." };
  if (!title) return { error: "Give the event a title." };
  try {
    await db.insert(schoolEvents).values({ schoolId: c.schoolId, eventDate: date, title: title.slice(0, 160), kind: input.kind?.trim() || "event", createdByUserId: c.userId });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "event.added", entityType: "Calendar", metadata: { title, date } });
    return { ok: true };
  } catch {
    return { error: "Could not add the event. Please try again." };
  }
}

export async function deleteEvent(id: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.canManage) return { error: "You don't have permission." };
  await db.delete(schoolEvents).where(and(eq(schoolEvents.id, id), eq(schoolEvents.schoolId, c.schoolId)));
  return { ok: true };
}
