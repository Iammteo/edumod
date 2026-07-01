"use server";

import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { schools, memberships, students, staffProfiles, users, accounts } from "@/db/schema";
import { generateSchoolCode } from "@/lib/identity/school-code";
import { SCHOOL_CODE_MAX_ATTEMPTS } from "@/lib/identity/config";
import { generateAdmissionNo } from "@/lib/identity/student-id";
import { generateStudentPassword } from "@/lib/identity/password";
import { logAudit } from "@/lib/audit";
import { composeUsername, normalizeIdentifier } from "@/lib/identity/student-id";
import { generateStaffId } from "@/lib/identity/staff-id";
import { isLockedOut, recordFailure, clearFailures, LOCKOUT_MINUTES } from "@/lib/rate-limit";
import { getOrCreateDeviceId, evaluateStaffDevice } from "@/lib/device-trust";
import { encryptSecret } from "@/lib/crypto";
import { sendSchoolCodeEmail, sendEmail } from "@/lib/email";

// Better Auth's password hasher (internal) - used so directly-inserted credential rows verify
// correctly at sign-in. Cast because $context is not fully typed for this access.
export async function hashPassword(plain: string): Promise<string> {
  const ctx = (await auth.$context) as unknown as { password: { hash(p: string): Promise<string> } };
  return ctx.password.hash(plain);
}

type Result = { ok: true } | { error: string };

// Postgres unique_violation - signals a school code / slug collision so we regenerate.
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

// Called right after an admin signs up - creates the organization + membership, then
// generates a unique school code and emails it to the admin. The code is system-assigned
// (the admin never picks it). Race-safe: regenerate on a unique-constraint collision.
export async function registerOrganization(input: { schoolName: string; state: string; country: string; address: string }): Promise<{ ok: true; schoolCode: string } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "You need to be signed in." };

  // Idempotent: if this account already has an organization, return it instead of failing.
  // This lets a half-finished signup (account created, org not) be completed on retry.
  const [existing] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (existing) {
    const [sch] = await db.select().from(schools).where(eq(schools.id, existing.schoolId)).limit(1);
    return { ok: true, schoolCode: sch?.schoolCode ?? "" };
  }

  const name = input.schoolName.trim();
  if (!name) return { error: "School name is required." };
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100) || "school";

  for (let attempt = 0; attempt < SCHOOL_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generateSchoolCode();
    try {
      const school = await db.transaction(async (tx) => {
        const [s] = await tx.insert(schools).values({
          name,
          slug: `${baseSlug}-${code}`,
          schoolCode: code,
          email: session.user.email,
          state: input.state.trim() || null,
          country: input.country.trim() || null,
          address: input.address.trim() || null,
        }).returning();
        await tx.insert(memberships).values({ schoolId: s.id, userId: session.user.id, role: "school_admin", canApprovePayments: true, canReleaseResults: true });
        return s;
      });
      await logAudit({ schoolId: school.id, actorUserId: session.user.id, action: "school.created", entityType: "School", entityId: school.id, metadata: { name } });
      // Fire-and-forget so the dashboard loads immediately; the code is also shown in the UI.
      void sendSchoolCodeEmail(session.user.email, name, code).catch((e) => console.error("[email] school code send failed:", e));
      return { ok: true, schoolCode: code };
    } catch (e) {
      if (isUniqueViolation(e)) continue; // code or slug collided - try a new code
      return { error: "Could not create the organization. Please try again." };
    }
  }
  return { error: "Could not allocate a unique school code right now. Please try again." };
}

export type StaffRole = "principal" | "vice_principal" | "teacher" | "secretary";
export type InviteStaffInput = {
  name: string; email: string;
  employmentType: string; role: StaffRole; jobRole?: string; startDate?: string; staffId?: string;
  isTeacher: boolean; isClassTeacher: boolean; assignedClass?: string;
  subjects: string[]; teachingClasses: string[];
  canApprovePayments: boolean;
  permissions: Record<string, string>;
};

// Admin invites a staff member with a full role/responsibility/permission assignment, then
// emails a set-password link. The staff profile is created as "pending" until they onboard.
export async function inviteStaff(input: InviteStaffInput): Promise<{ ok: true; staffId: string } | { error: string }> {
  const ctx = await context();
  if (!ctx?.schoolId || ctx.role !== "school_admin") return { error: "Only an admin can invite staff." };
  if (!ctx.school?.schoolCode) return { error: "Your organization has no school code set." };
  const email = input.email.trim();
  if (!input.name.trim() || !email) return { error: "Name and email are required." };
  // Create the auth account first (this is what enforces unique email).
  let userId: string | undefined;
  try {
    const res = await auth.api.signUpEmail({ body: { name: input.name.trim(), email, password: `${randomUUID()}Aa1!`, accountType: "staff" } as never });
    userId = (res as { user?: { id?: string } }).user?.id;
  } catch {
    return { error: "Could not invite this staff member - the email may already be in use." };
  }
  if (!userId) return { error: "Could not create the staff account." };
  const inviteToken = randomUUID();
  const inviteTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // invite links expire after 7 days
  let staffId = "";
  try {
    await db.transaction(async (tx) => {
      // Allocate a globally-unique Staff ID, which becomes the Better Auth username so the staffer
      // can sign in with it (in addition to their email). Prefer an admin-supplied ID if it's free.
      let usernameValue = "";
      const preferred = input.staffId?.trim();
      for (let i = 0; i < 14; i++) {
        const cand = i === 0 && preferred ? preferred : generateStaffId(ctx.school!.name, ctx.school!.schoolCode!);
        const uname = normalizeIdentifier(cand);
        const [taken] = await tx.select({ id: users.id }).from(users).where(eq(users.username, uname)).limit(1);
        if (!taken) { staffId = cand; usernameValue = uname; break; }
      }
      if (!usernameValue) throw new Error("staff-id-allocation-failed");
      await tx.update(users).set({ username: usernameValue, displayUsername: staffId, updatedAt: new Date() }).where(eq(users.id, userId));
      await tx.insert(memberships).values({
        schoolId: ctx.schoolId!, userId, role: input.role,
        canApprovePayments: input.canApprovePayments,
        canReleaseResults: input.permissions.results === "approve",
      });
      await tx.insert(staffProfiles).values({
        schoolId: ctx.schoolId!, userId,
        staffNo: staffId,
        employmentType: input.employmentType,
        jobRole: input.jobRole?.trim() || null,
        startDate: input.startDate || null,
        status: "pending",
        isTeacher: input.isTeacher,
        isClassTeacher: input.isClassTeacher,
        assignedClass: input.assignedClass?.trim() || null,
        subjects: input.subjects,
        teachingClasses: input.teachingClasses,
        permissions: input.permissions,
        inviteToken,
        inviteTokenExpiresAt,
      });
    });
    const link = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/onboarding?invite=${inviteToken}`;
    void sendEmail({
      to: email,
      subject: `You're invited to join ${ctx.school?.name ?? "your school"} on Edumod`,
      text: `Hi ${input.name.trim()},\n\nYou've been invited to join ${ctx.school?.name ?? "your school"} on Edumod${input.jobRole ? ` as a ${input.jobRole}` : ""}.\n\nYour Staff ID is ${staffId}. Once you've set your password you can sign in with either your Staff ID or your email.\n\nGet started by setting your password and completing your profile:\n${link}\n\nThis link is personal to you - please don't share it.`,
    }).catch((e) => console.error("[email] staff invite send failed:", e));
    await logAudit({ schoolId: ctx.schoolId, actorUserId: ctx.userId, action: "staff.invited", entityType: "Staff", entityId: userId, metadata: { name: input.name.trim(), role: input.role, staffId } });
    return { ok: true, staffId };
  } catch {
    // The auth account was created but profile/membership setup failed - delete it so the email
    // isn't left orphaned (which would block re-inviting).
    await db.delete(users).where(eq(users.id, userId)).catch(() => {});
    return { error: "Could not complete the invite. Please try again." };
  }
}

// Admin or staff creates a student. The system assigns the Student ID (YY-NNNNN) and a one-time
// password, both returned once so the creator can pass them on. Students have no email; they log
// in via the username plugin with school code + Student ID. User + credential are inserted directly
// (signUpEmail requires an email, which students don't have).
export async function createStudent(input: { name: string; className?: string }): Promise<{ ok: true; studentId: string; password: string } | { error: string }> {
  const ctx = await context();
  if (!ctx?.schoolId || (ctx.role !== "school_admin" && ctx.role !== "teacher")) return { error: "You are not allowed to add students." };
  if (!ctx.school?.schoolCode) return { error: "Your organization has no school code set." };
  const name = input.name.trim();
  if (!name) return { error: "Student name is required." };
  const className = input.className?.trim() || null;
  const [firstName, ...rest] = name.split(/\s+/);
  const lastName = rest.join(" ") || firstName;
  const password = generateStudentPassword(ctx.school.name);
  const year = new Date().getFullYear();
  try {
    const hash = await hashPassword(password);
    const userId = randomUUID();
    const now = new Date();
    // All four inserts succeed or none do - no orphaned user/account/membership on a partial failure.
    const admissionNo = await db.transaction(async (tx) => {
      let no = "";
      for (let i = 0; i < 12; i++) {
        const cand = generateAdmissionNo(year);
        const [exists] = await tx.select({ id: students.id }).from(students).where(and(eq(students.schoolId, ctx.schoolId!), eq(students.admissionNo, cand))).limit(1);
        if (!exists) { no = cand; break; }
      }
      if (!no) throw new Error("admission-allocation-failed");
      const usernameValue = composeUsername(ctx.school!.schoolCode!, no);
      await tx.insert(users).values({ id: userId, name, email: null, emailVerified: false, accountType: "student", username: usernameValue, displayUsername: usernameValue, createdAt: now, updatedAt: now });
      await tx.insert(accounts).values({ id: randomUUID(), accountId: userId, providerId: "credential", userId, password: hash, createdAt: now, updatedAt: now });
      await tx.insert(students).values({ schoolId: ctx.schoolId!, admissionNo: no, firstName, lastName, className, userId, credentialEnc: encryptSecret(password) });
      await tx.insert(memberships).values({ schoolId: ctx.schoolId!, userId, role: "student" });
      return no;
    });
    await logAudit({ schoolId: ctx.schoolId, actorUserId: ctx.userId, action: "student.added", entityType: "Student", entityId: userId, metadata: { name, admissionNo, className: className ?? null } });
    return { ok: true, studentId: admissionNo, password };
  } catch {
    return { error: "Could not create the student. Please try again." };
  }
}

// Admin/teacher resets a student's password (students can't self-reset - no email). Returns the
// new one-time password to hand over.
export async function resetStudentPassword(input: { studentId: string }): Promise<{ ok: true; studentName: string; password: string } | { error: string }> {
  const ctx = await context();
  if (!ctx?.schoolId || (ctx.role !== "school_admin" && ctx.role !== "teacher")) return { error: "You are not allowed to reset student passwords." };
  const [student] = await db.select().from(students).where(and(eq(students.schoolId, ctx.schoolId), eq(students.admissionNo, input.studentId.trim()))).limit(1);
  if (!student?.userId) return { error: "No student found with that ID in your school." };
  const password = generateStudentPassword(ctx.school?.name ?? undefined);
  try {
    const hash = await hashPassword(password);
    await db.update(accounts).set({ password: hash, updatedAt: new Date() }).where(and(eq(accounts.userId, student.userId), eq(accounts.providerId, "credential")));
    await db.update(students).set({ credentialEnc: encryptSecret(password), updatedAt: new Date() }).where(eq(students.id, student.id));
    await logAudit({ schoolId: ctx.schoolId, actorUserId: ctx.userId, action: "student.password_reset", entityType: "Student", entityId: student.userId, metadata: { name: `${student.firstName} ${student.lastName}`.trim() } });
    return { ok: true, studentName: `${student.firstName} ${student.lastName}`.trim(), password };
  } catch {
    return { error: "Could not reset the password. Please try again." };
  }
}

// Marks a staff member active / inactive / left. Keeps the account & history (use removeStaff to delete).
export async function setStaffStatus(userId: string, status: "active" | "inactive" | "left"): Promise<{ ok: true } | { error: string }> {
  const ctx = await context();
  if (!ctx?.schoolId || ctx.role !== "school_admin") return { error: "Only an admin can change staff status." };
  if (userId === ctx.userId) return { error: "You can't change your own status." };
  const [m] = await db.select({ role: memberships.role }).from(memberships).where(and(eq(memberships.schoolId, ctx.schoolId), eq(memberships.userId, userId))).limit(1);
  if (!m) return { error: "Staff member not found." };
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  try {
    await db.update(staffProfiles).set({ status, updatedAt: new Date() }).where(and(eq(staffProfiles.schoolId, ctx.schoolId), eq(staffProfiles.userId, userId)));
    await logAudit({ schoolId: ctx.schoolId, actorUserId: ctx.userId, action: "staff.status_changed", entityType: "Staff", entityId: userId, metadata: { name: u?.name ?? "Staff", status } });
    return { ok: true };
  } catch {
    return { error: "Could not update the status. Please try again." };
  }
}

// Permanently removes a staff member (account, membership, profile). Blocked for admins and for
// staff who have recorded/approved payments (keeps the financial trail intact - mark them "left" instead).
export async function removeStaff(userId: string): Promise<{ ok: true } | { error: string }> {
  const ctx = await context();
  if (!ctx?.schoolId || ctx.role !== "school_admin") return { error: "Only an admin can remove staff." };
  if (userId === ctx.userId) return { error: "You can't remove yourself." };
  const [m] = await db.select({ role: memberships.role }).from(memberships).where(and(eq(memberships.schoolId, ctx.schoolId), eq(memberships.userId, userId))).limit(1);
  if (!m) return { error: "Staff member not found." };
  if (m.role === "school_admin") return { error: "You can't remove another admin." };
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  try {
    await db.delete(users).where(eq(users.id, userId)); // cascades membership + staff profile
    await logAudit({ schoolId: ctx.schoolId, actorUserId: ctx.userId, action: "staff.removed", entityType: "Staff", entityId: userId, metadata: { name: u?.name ?? "Staff" } });
    return { ok: true };
  } catch {
    return { error: "This staff member has financial records and can't be deleted. Mark them as “left” instead." };
  }
}

// Three-field student login: composes the username server-side and signs in, with per-account +
// per-IP lockout. Errors are uniform so they never reveal whether a code/ID pair exists.
export async function studentLogin(input: { schoolCode: string; studentId: string; password: string }): Promise<{ ok: true } | { error: string }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
  const usernameValue = composeUsername(input.schoolCode, input.studentId);
  const keys = [`user:${usernameValue}`, `ip:${ip}`];
  if (await isLockedOut(keys)) return { error: `Too many failed attempts. For security this login is locked for ${LOCKOUT_MINUTES} minutes — please try again after that.` };
  try {
    await (auth.api as unknown as { signInUsername(a: { body: { username: string; password: string; rememberMe: boolean }; headers: Headers }): Promise<unknown> })
      .signInUsername({ body: { username: usernameValue, password: input.password, rememberMe: false }, headers: h as unknown as Headers });
    await clearFailures(keys);
    return { ok: true };
  } catch {
    await recordFailure(keys);
    return { error: "Invalid school code, Student ID, or password." };
  }
}

// Staff sign-in with a Staff ID (the Better Auth username) + password - an alternative to email.
// Same per-account + per-IP lockout as students; uniform error so it doesn't reveal valid IDs.
export async function staffLogin(input: { staffId: string; password: string }): Promise<{ ok: true } | { error: string }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
  const usernameValue = normalizeIdentifier(input.staffId);
  const keys = [`user:${usernameValue}`, `ip:${ip}`];
  if (await isLockedOut(keys)) return { error: `Too many failed attempts. For security this login is locked for ${LOCKOUT_MINUTES} minutes — please try again after that.` };
  // Block disabled/departed staff before authenticating (offboarding gate).
  const [prof] = await db.select({ userId: users.id, status: staffProfiles.status, role: memberships.role, schoolId: memberships.schoolId })
    .from(users).leftJoin(staffProfiles, eq(staffProfiles.userId, users.id)).leftJoin(memberships, eq(memberships.userId, users.id))
    .where(eq(users.username, usernameValue)).limit(1);
  if (prof?.status === "left" || prof?.status === "inactive") return { error: "Your access has been disabled. Please contact your school admin." };
  // Device trust (staff only; admins can sign in anywhere). New devices need admin approval.
  if (prof?.userId) {
    const dec = await evaluateStaffDevice(prof.userId, await getOrCreateDeviceId());
    if (!dec.allow) return { error: dec.message ?? "This device needs admin approval before you can sign in." };
  }
  try {
    await (auth.api as unknown as { signInUsername(a: { body: { username: string; password: string; rememberMe: boolean }; headers: Headers }): Promise<unknown> })
      .signInUsername({ body: { username: usernameValue, password: input.password, rememberMe: false }, headers: h as unknown as Headers });
    await clearFailures(keys);
    return { ok: true };
  } catch {
    await recordFailure(keys);
    return { error: "Invalid Staff ID or password." };
  }
}
