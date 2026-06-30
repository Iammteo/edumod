"use server";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { academicTerms, memberships, schools } from "@/db/schema";
import { logAudit } from "@/lib/audit";

async function ctx() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, s.user.id)).limit(1);
  if (!m) return null;
  return { userId: s.user.id, schoolId: m.schoolId, isAdmin: ["school_admin", "principal", "vice_principal", "secretary"].includes(m.role) };
}

export type SessionTerm = { session: string; term: string; current: boolean };

// All admin-created (session, term) pairs, plus the active one (so the switcher always shows it).
// Sorted by newest session first, then term.
export async function listAcademicTerms(): Promise<SessionTerm[]> {
  const c = await ctx();
  if (!c) return [];
  const [rows, [sch]] = await Promise.all([
    db.select({ session: academicTerms.session, term: academicTerms.term }).from(academicTerms).where(eq(academicTerms.schoolId, c.schoolId)),
    db.select({ s: schools.currentSession, t: schools.currentTerm }).from(schools).where(eq(schools.id, c.schoolId)).limit(1),
  ]);
  const curS = sch?.s ?? "", curT = sch?.t ?? "";
  const list = rows.map((r) => ({ session: r.session, term: r.term }));
  if (curS && curT && !list.some((x) => x.session === curS && x.term === curT)) list.push({ session: curS, term: curT });
  return list
    .sort((a, b) => b.session.localeCompare(a.session) || a.term.localeCompare(b.term))
    .map((x) => ({ ...x, current: x.session === curS && x.term === curT }));
}

export async function createAcademicTerm(input: { session: string; term: string }): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.isAdmin) return { error: "Only an admin can add sessions or terms." };
  const session = input.session.trim().replace(/\s+/g, " ");
  const term = input.term.trim().replace(/\s+/g, " ");
  if (!session || !term) return { error: "Enter both a session and a term." };
  if (session.length > 40 || term.length > 40) return { error: "Session or term name is too long." };
  try {
    await db.insert(academicTerms).values({ schoolId: c.schoolId, session, term }).onConflictDoNothing();
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "academics.term_created", entityType: "Academics", metadata: { session, term } });
    return { ok: true };
  } catch {
    return { error: "Could not add that. Please try again." };
  }
}

export async function deleteAcademicTerm(input: { session: string; term: string }): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.isAdmin) return { error: "Only an admin can remove terms." };
  const [sch] = await db.select({ s: schools.currentSession, t: schools.currentTerm }).from(schools).where(eq(schools.id, c.schoolId)).limit(1);
  if (sch && sch.s === input.session && sch.t === input.term) return { error: "You can't remove the active term - switch to another first." };
  try {
    await db.delete(academicTerms).where(and(eq(academicTerms.schoolId, c.schoolId), eq(academicTerms.session, input.session), eq(academicTerms.term, input.term)));
    return { ok: true };
  } catch {
    return { error: "Could not remove that. Please try again." };
  }
}

// Switch the school's active period. Ensures the pair exists, then updates the display fields.
export async function setCurrentPeriod(input: { session: string; term: string }): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c?.isAdmin) return { error: "Only an admin can switch the term." };
  const session = input.session.trim().replace(/\s+/g, " ");
  const term = input.term.trim().replace(/\s+/g, " ");
  if (!session || !term) return { error: "Pick a session and term." };
  try {
    await db.insert(academicTerms).values({ schoolId: c.schoolId, session, term }).onConflictDoNothing();
    await db.update(schools).set({ currentSession: session, currentTerm: term, updatedAt: new Date() }).where(eq(schools.id, c.schoolId));
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: "academics.switched", entityType: "Academics", metadata: { session, term } });
    return { ok: true };
  } catch {
    return { error: "Could not switch. Please try again." };
  }
}
