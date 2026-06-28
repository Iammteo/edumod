"use server";

import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { classes, memberships, students } from "@/db/schema";
import { SCHOOL_CLASSES } from "@/lib/classes";
import { logAudit } from "@/lib/audit";

async function ctx() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, s.user.id)).limit(1);
  if (!m) return null;
  return { userId: s.user.id, schoolId: m.schoolId, role: m.role, isAdmin: ["school_admin", "principal", "vice_principal"].includes(m.role) };
}

// Sort Primary → JSS → SSS by number, then custom classes alphabetically after.
function inferLevel(name: string): string | null {
  if (/^primary/i.test(name)) return "Primary";
  if (/^jss/i.test(name)) return "JSS";
  if (/^sss/i.test(name)) return "SSS";
  return null;
}
function rankClass(name: string): number {
  const tier = inferLevel(name);
  const num = parseInt(name.replace(/\D/g, ""), 10) || 0;
  if (tier === "Primary") return 100 + num;
  if (tier === "JSS") return 200 + num;
  if (tier === "SSS") return 300 + num;
  return 9000;
}

export type ManagedClass = { name: string; custom: boolean; students: number };

// Merged class list: built-in defaults ∪ admin-created classes ∪ any class a student is already in.
// `custom` marks admin-created classes (the only ones that can be deleted). Visible to any member.
export async function listClasses(): Promise<ManagedClass[]> {
  const c = await ctx();
  if (!c) return [];
  const [custom, counts] = await Promise.all([
    db.select({ name: classes.name }).from(classes).where(eq(classes.schoolId, c.schoolId)),
    db.select({ name: students.className, n: sql<number>`count(*)::int` }).from(students).where(eq(students.schoolId, c.schoolId)).groupBy(students.className),
  ]);
  const customSet = new Set(custom.map((x) => x.name));
  const countMap = new Map(counts.filter((x) => x.name).map((x) => [x.name as string, x.n]));
  const names = new Set<string>([...SCHOOL_CLASSES, ...customSet, ...countMap.keys()]);
  return [...names]
    .map((name) => ({ name, custom: customSet.has(name) && !SCHOOL_CLASSES.includes(name), students: countMap.get(name) ?? 0 }))
    .sort((a, b) => rankClass(a.name) - rankClass(b.name) || a.name.localeCompare(b.name));
}

export async function createClass(name: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.isAdmin) return { error: "Only an admin can create classes." };
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) return { error: "Enter a class name." };
  if (n.length > 60) return { error: "That class name is too long." };
  try {
    await db.insert(classes).values({ schoolId: c.schoolId, name: n, level: inferLevel(n) }).onConflictDoNothing();
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "class.created", entityType: "Class", metadata: { name: n } });
    return { ok: true };
  } catch {
    return { error: "Could not create the class. Please try again." };
  }
}

export async function deleteClass(name: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.isAdmin) return { error: "Only an admin can remove classes." };
  if (SCHOOL_CLASSES.includes(name)) return { error: "Built-in classes can't be removed." };
  const [used] = await db.select({ id: students.id }).from(students).where(and(eq(students.schoolId, c.schoolId), eq(students.className, name))).limit(1);
  if (used) return { error: "Students are still assigned to this class — reassign them first." };
  try {
    await db.delete(classes).where(and(eq(classes.schoolId, c.schoolId), eq(classes.name, name)));
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "class.removed", entityType: "Class", metadata: { name } });
    return { ok: true };
  } catch {
    return { error: "Could not remove the class. Please try again." };
  }
}
