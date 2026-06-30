"use server";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth/context";
import { classes, students, staffProfiles, studentAttendance, feeStructures } from "@/db/schema";
import { SCHOOL_CLASSES } from "@/lib/classes";
import { logAudit } from "@/lib/audit";

async function ctx() {
  const a = await getAuthContext();
  if (!a) return null;
  return { userId: a.userId, schoolId: a.schoolId, role: a.role, isAdmin: ["school_admin", "principal", "vice_principal", "secretary"].includes(a.role) };
}

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

// On the first edit, materialise the built-in defaults (plus any class a student already uses) as
// real rows so every class - including the defaults - becomes editable. After this the table is the
// single source of truth; built-ins are no longer re-injected.
async function seed(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], schoolId: string) {
  const [one] = await tx.select({ id: classes.id }).from(classes).where(eq(classes.schoolId, schoolId)).limit(1);
  if (one) return;
  const used = await tx.select({ name: students.className }).from(students).where(eq(students.schoolId, schoolId)).groupBy(students.className);
  const names = new Set<string>(SCHOOL_CLASSES);
  for (const u of used) if (u.name) names.add(u.name);
  await tx.insert(classes).values([...names].map((n) => ({ schoolId, name: n, level: inferLevel(n) }))).onConflictDoNothing();
}

export type ManagedClass = { name: string; students: number; builtin: boolean };

// Merged class list. Once the school has edited classes the table is authoritative; before that we
// fall back to the built-in defaults so pickers are never empty. `builtin` is cosmetic (a badge);
// every class is editable.
export async function listClasses(): Promise<ManagedClass[]> {
  const c = await ctx();
  if (!c) return [];
  const [rows, counts] = await Promise.all([
    db.select({ name: classes.name }).from(classes).where(eq(classes.schoolId, c.schoolId)),
    db.select({ name: students.className, n: sql<number>`count(*)::int` }).from(students).where(eq(students.schoolId, c.schoolId)).groupBy(students.className),
  ]);
  const countMap = new Map(counts.filter((x) => x.name).map((x) => [x.name as string, x.n]));
  const tableNames = rows.map((r) => r.name);
  const base = tableNames.length ? tableNames : SCHOOL_CLASSES; // defaults only until the first edit
  const names = new Set<string>(base);
  for (const k of countMap.keys()) names.add(k);
  return [...names]
    .map((name) => ({ name, students: countMap.get(name) ?? 0, builtin: (SCHOOL_CLASSES as readonly string[]).includes(name) }))
    .sort((a, b) => rankClass(a.name) - rankClass(b.name) || a.name.localeCompare(b.name));
}

export async function createClass(name: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.isAdmin) return { error: "Only an admin can create classes." };
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) return { error: "Enter a class name." };
  if (n.length > 60) return { error: "That class name is too long." };
  try {
    await db.transaction(async (tx) => {
      await seed(tx, c.schoolId);
      await tx.insert(classes).values({ schoolId: c.schoolId, name: n, level: inferLevel(n) }).onConflictDoNothing();
    });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "class.created", entityType: "Class", metadata: { name: n } });
    return { ok: true };
  } catch {
    return { error: "Could not create the class. Please try again." };
  }
}

// Rename any class (built-in or custom). The new name cascades to every student in that class.
export async function renameClass(oldName: string, newName: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.isAdmin) return { error: "Only an admin can rename classes." };
  const from = oldName.trim();
  const to = newName.trim().replace(/\s+/g, " ");
  if (!to) return { error: "Enter a class name." };
  if (to.length > 60) return { error: "That class name is too long." };
  if (to === from) return { ok: true };
  try {
    const res = await db.transaction(async (tx): Promise<{ ok: true } | { error: string }> => {
      await seed(tx, c.schoolId);
      const [dup] = await tx.select({ id: classes.id }).from(classes).where(and(eq(classes.schoolId, c.schoolId), eq(classes.name, to))).limit(1);
      if (dup) return { error: "A class with that name already exists." };
      await tx.update(classes).set({ name: to, level: inferLevel(to), updatedAt: new Date() }).where(and(eq(classes.schoolId, c.schoolId), eq(classes.name, from)));
      // Cascade the rename to every place a class name is stored as free text, so a rename can't
      // silently orphan rosters, teacher assignments, historical attendance or class-targeted fees.
      await tx.update(students).set({ className: to, updatedAt: new Date() }).where(and(eq(students.schoolId, c.schoolId), eq(students.className, from)));
      await tx.update(staffProfiles).set({ assignedClass: to, updatedAt: new Date() }).where(and(eq(staffProfiles.schoolId, c.schoolId), eq(staffProfiles.assignedClass, from)));
      await tx.update(studentAttendance).set({ className: to }).where(and(eq(studentAttendance.schoolId, c.schoolId), eq(studentAttendance.className, from)));
      // jsonb string-array columns: swap the matching element in place.
      await tx.execute(sql`update staff_profiles set teaching_classes = (select coalesce(jsonb_agg(case when e = ${from} then ${to} else e end), '[]'::jsonb) from jsonb_array_elements_text(teaching_classes) e) where school_id = ${c.schoolId} and teaching_classes ? ${from}`);
      await tx.execute(sql`update fee_structures set classes = (select coalesce(jsonb_agg(case when e = ${from} then ${to} else e end), '[]'::jsonb) from jsonb_array_elements_text(classes) e) where school_id = ${c.schoolId} and classes ? ${from}`);
      return { ok: true };
    });
    if ("error" in res) return res;
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "class.renamed", entityType: "Class", metadata: { from, to } });
    return { ok: true };
  } catch {
    return { error: "Could not rename the class. Please try again." };
  }
}

export async function deleteClass(name: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.isAdmin) return { error: "Only an admin can remove classes." };
  const [used] = await db.select({ id: students.id }).from(students).where(and(eq(students.schoolId, c.schoolId), eq(students.className, name))).limit(1);
  if (used) return { error: "Students are still assigned to this class - reassign them first." };
  try {
    await db.transaction(async (tx) => {
      await seed(tx, c.schoolId);
      await tx.delete(classes).where(and(eq(classes.schoolId, c.schoolId), eq(classes.name, name)));
    });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "class.removed", entityType: "Class", metadata: { name } });
    return { ok: true };
  } catch {
    return { error: "Could not remove the class. Please try again." };
  }
}
