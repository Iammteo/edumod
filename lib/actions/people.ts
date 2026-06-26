"use server";

import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { schools, memberships, students, staffProfiles, users, accounts } from "@/db/schema";
import { generateSchoolCode } from "@/lib/identity/school-code";
import { SCHOOL_CODE_MAX_ATTEMPTS } from "@/lib/identity/config";
import { allocateStudentId } from "@/lib/identity/allocate";
import { generateStudentPassword } from "@/lib/identity/password";
import { composeUsername } from "@/lib/identity/student-id";
import { isLockedOut, recordFailure, clearFailures } from "@/lib/rate-limit";
import { sendSchoolCodeEmail } from "@/lib/email";

// Better Auth's password hasher (internal) — used so directly-inserted credential rows verify
// correctly at sign-in. Cast because $context is not fully typed for this access.
async function hashPassword(plain: string): Promise<string> {
  const ctx = (await auth.$context) as unknown as { password: { hash(p: string): Promise<string> } };
  return ctx.password.hash(plain);
}

type Result = { ok: true } | { error: string };

// Postgres unique_violation — signals a school code / slug collision so we regenerate.
function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}

async function context() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (!m) return { userId: session.user.id, schoolId: null, role: null, school: null };
  const [school] = await db.select().from(schools).where(eq(schools.id, m.schoolId)).limit(1);
  return { userId: session.user.id, schoolId: m.schoolId, role: m.role, school: school ?? null };
}

// Called right after an admin signs up — creates the organization + membership, then
// generates a unique school code and emails it to the admin. The code is system-assigned
// (the admin never picks it). Race-safe: regenerate on a unique-constraint collision.
export async function registerOrganization(input: { schoolName: string; state: string; country: string; address: string }): Promise<{ ok: true; schoolCode: string } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "You need to be signed in." };
  const name = input.schoolName.trim();
  if (!name) return { error: "School name is required." };
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100) || "school";

  for (let attempt = 0; attempt < SCHOOL_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generateSchoolCode();
    try {
      const [school] = await db.insert(schools).values({
        name,
        slug: `${baseSlug}-${code}`,
        schoolCode: code,
        email: session.user.email,
        state: input.state.trim() || null,
        country: input.country.trim() || null,
        address: input.address.trim() || null,
      }).returning();
      await db.insert(memberships).values({ schoolId: school.id, userId: session.user.id, role: "school_admin", canApprovePayments: true, canReleaseResults: true });
      await sendSchoolCodeEmail(session.user.email, name, code);
      return { ok: true, schoolCode: code };
    } catch (e) {
      if (isUniqueViolation(e)) continue; // code or slug collided — try a new code
      return { error: "Could not create the organization. Please try again." };
    }
  }
  return { error: "Could not allocate a unique school code right now. Please try again." };
}

// Admin invites a teacher: creates the account and emails a set-password link.
export async function inviteStaff(input: { name: string; email: string }): Promise<Result> {
  const ctx = await context();
  if (!ctx?.schoolId || ctx.role !== "school_admin") return { error: "Only an admin can invite staff." };
  try {
    const res = await auth.api.signUpEmail({ body: { name: input.name.trim(), email: input.email.trim(), password: `${randomUUID()}Aa1!`, accountType: "staff" } as never });
    const userId = (res as { user?: { id?: string } }).user?.id;
    if (!userId) return { error: "Could not create the staff account." };
    await db.insert(memberships).values({ schoolId: ctx.schoolId, userId, role: "teacher" });
    await db.insert(staffProfiles).values({ schoolId: ctx.schoolId, userId });
    await auth.api.requestPasswordReset({ body: { email: input.email.trim(), redirectTo: "/reset-password" } });
    return { ok: true };
  } catch {
    return { error: "Could not invite this teacher — the email may already be in use." };
  }
}

// Admin or staff creates a student. The system assigns the Student ID (YY-NNNNN) and a one-time
// password, both returned once so the creator can pass them on. Students have no email; they log
// in via the username plugin with school code + Student ID. User + credential are inserted directly
// (signUpEmail requires an email, which students don't have).
export async function createStudent(input: { name: string }): Promise<{ ok: true; studentId: string; password: string } | { error: string }> {
  const ctx = await context();
  if (!ctx?.schoolId || (ctx.role !== "school_admin" && ctx.role !== "teacher")) return { error: "You are not allowed to add students." };
  if (!ctx.school?.schoolCode) return { error: "Your organization has no school code set." };
  const name = input.name.trim();
  if (!name) return { error: "Student name is required." };
  const [firstName, ...rest] = name.split(/\s+/);
  const lastName = rest.join(" ") || firstName;
  const password = generateStudentPassword();
  const year = new Date().getFullYear();
  try {
    const hash = await hashPassword(password);
    const { admissionNo } = await allocateStudentId(db, ctx.schoolId, year);
    const usernameValue = composeUsername(ctx.school.schoolCode, admissionNo);
    const userId = randomUUID();
    const now = new Date();
    await db.insert(users).values({ id: userId, name, email: null, emailVerified: false, accountType: "student", username: usernameValue, displayUsername: usernameValue, createdAt: now, updatedAt: now });
    await db.insert(accounts).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: hash, createdAt: now, updatedAt: now });
    await db.insert(students).values({ schoolId: ctx.schoolId, admissionNo, firstName, lastName, userId });
    await db.insert(memberships).values({ schoolId: ctx.schoolId, userId, role: "student" });
    return { ok: true, studentId: admissionNo, password };
  } catch {
    return { error: "Could not create the student. Please try again." };
  }
}

// Admin/teacher resets a student's password (students can't self-reset — no email). Returns the
// new one-time password to hand over.
export async function resetStudentPassword(input: { studentId: string }): Promise<{ ok: true; studentName: string; password: string } | { error: string }> {
  const ctx = await context();
  if (!ctx?.schoolId || (ctx.role !== "school_admin" && ctx.role !== "teacher")) return { error: "You are not allowed to reset student passwords." };
  const [student] = await db.select().from(students).where(and(eq(students.schoolId, ctx.schoolId), eq(students.admissionNo, input.studentId.trim()))).limit(1);
  if (!student?.userId) return { error: "No student found with that ID in your school." };
  const password = generateStudentPassword();
  try {
    const hash = await hashPassword(password);
    await db.update(accounts).set({ password: hash, updatedAt: new Date() }).where(and(eq(accounts.userId, student.userId), eq(accounts.providerId, "credential")));
    return { ok: true, studentName: `${student.firstName} ${student.lastName}`.trim(), password };
  } catch {
    return { error: "Could not reset the password. Please try again." };
  }
}

// Three-field student login: composes the username server-side and signs in, with per-account +
// per-IP lockout. Errors are uniform so they never reveal whether a code/ID pair exists.
export async function studentLogin(input: { schoolCode: string; studentId: string; password: string }): Promise<{ ok: true } | { error: string }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
  const usernameValue = composeUsername(input.schoolCode, input.studentId);
  const keys = [`user:${usernameValue}`, `ip:${ip}`];
  if (await isLockedOut(keys)) return { error: "Too many attempts. Please wait a few minutes and try again." };
  try {
    await (auth.api as unknown as { signInUsername(a: { body: { username: string; password: string }; headers: Headers }): Promise<unknown> })
      .signInUsername({ body: { username: usernameValue, password: input.password }, headers: h as unknown as Headers });
    await clearFailures(keys);
    return { ok: true };
  } catch {
    await recordFailure(keys);
    return { error: "Invalid school code, Student ID, or password." };
  }
}
