"use server";

import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, students } from "@/db/schema";
import { logAudit } from "@/lib/audit";

const GRADUATED = "Graduated";

async function ctx() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const [m] = await db.select({ schoolId: memberships.schoolId, role: memberships.role }).from(memberships).where(eq(memberships.userId, s.user.id)).limit(1);
  if (!m) return null;
  return { userId: s.user.id, schoolId: m.schoolId, canManage: ["school_admin", "principal", "vice_principal", "secretary"].includes(m.role) };
}

// Natural ordering of class names so "next class" can be derived: rank by level, then trailing number.
function sortKey(name: string): number {
  const l = name.toLowerCase();
  const rank = /nursery|creche|kg|reception/.test(l) ? 0 : /pry|primary|basic/.test(l) ? 1 : /jss|j\.?s\.?s|junior/.test(l) ? 2 : /sss|s\.?s\.?s|senior/.test(l) ? 3 : 4;
  const num = Number((l.match(/(\d+)/) || [])[1] ?? 99);
  return rank * 1000 + num;
}

export type PromotionGroup = { className: string; suggested: string; students: { id: string; name: string }[] };
export async function getPromotionPlan(): Promise<{ groups: PromotionGroup[]; classOptions: string[] } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (!c.canManage) return { error: "Only an admin can promote students." };
  const rows = await db.select({ id: students.id, fn: students.firstName, ln: students.lastName, className: students.className }).from(students).where(eq(students.schoolId, c.schoolId));
  const classes = [...new Set(rows.map((r) => r.className).filter((x): x is string => !!x && x !== GRADUATED))].sort((a, b) => sortKey(a) - sortKey(b));
  // The next class is the following one in natural order; the highest class graduates.
  const nextOf = new Map<string, string>();
  classes.forEach((cn, i) => nextOf.set(cn, classes[i + 1] ?? GRADUATED));
  const byClass = new Map<string, { id: string; name: string }[]>();
  for (const r of rows) { const k = r.className || "Unassigned"; (byClass.get(k) ?? byClass.set(k, []).get(k)!).push({ id: r.id, name: `${r.fn} ${r.ln}`.trim() }); }
  const groups: PromotionGroup[] = [...byClass.entries()]
    .sort(([a], [b]) => sortKey(a) - sortKey(b))
    .map(([className, studs]) => ({ className, suggested: nextOf.get(className) ?? className, students: studs.sort((a, b) => a.name.localeCompare(b.name)) }));
  return { groups, classOptions: [...classes, GRADUATED] };
}

// Apply per-student promotions (moves where the target differs from the current class).
export async function promoteStudents(input: { moves: { studentId: string; toClass: string }[] }): Promise<{ ok: true; count: number } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (!c.canManage) return { error: "Only an admin can promote students." };
  const moves = (input.moves ?? []).filter((m) => m.studentId && m.toClass);
  if (moves.length === 0) return { error: "No changes to apply." };
  // Group student ids by destination so each class is one UPDATE.
  const byTarget = new Map<string, string[]>();
  for (const m of moves) (byTarget.get(m.toClass) ?? byTarget.set(m.toClass, []).get(m.toClass)!).push(m.studentId);
  // Only allow promoting into a real class in this school (or "Graduated") — never an arbitrary
  // free-text value that would silently orphan students from rosters/attendance/fees.
  const valid = new Set<string>([GRADUATED]);
  const classRows = await db.select({ cn: students.className }).from(students).where(eq(students.schoolId, c.schoolId)).groupBy(students.className);
  for (const r of classRows) if (r.cn) valid.add(r.cn);
  for (const t of byTarget.keys()) if (!valid.has(t)) return { error: `"${t}" isn't a class in your school.` };
  try {
    await db.transaction(async (tx) => {
      for (const [toClass, ids] of byTarget) {
        await tx.update(students).set({ className: toClass, updatedAt: new Date() }).where(and(eq(students.schoolId, c.schoolId), inArray(students.id, ids)));
      }
    });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "students.promoted", entityType: "Student", metadata: { count: moves.length } });
    return { ok: true, count: moves.length };
  } catch {
    return { error: "Could not apply the promotion. Please try again." };
  }
}
