"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accounts, memberships, schools, staffProfiles, users } from "@/db/schema";
import { hashPassword } from "./people";
import { logAudit } from "@/lib/audit";
import { getOrCreateDeviceId, trustDevice, deviceLabel } from "@/lib/device-trust";
import { sniffImage } from "@/lib/image-upload";

export type Invite = { name: string; email: string; schoolName: string; role: string; employmentType: string | null; jobRole: string | null; isClassTeacher: boolean; assignedClass: string | null; subjects: string[]; teachingClasses: string[] };

// Public (token-gated) lookup of an invitation's context for the onboarding screen.
export async function getInvite(token: string): Promise<Invite | null> {
  if (!token) return null;
  const [sp] = await db.select().from(staffProfiles).where(eq(staffProfiles.inviteToken, token)).limit(1);
  if (!sp) return null;
  if (sp.inviteTokenExpiresAt && sp.inviteTokenExpiresAt.getTime() < Date.now()) return null;
  const [user] = await db.select().from(users).where(eq(users.id, sp.userId)).limit(1);
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, sp.userId)).limit(1);
  const [school] = await db.select().from(schools).where(eq(schools.id, sp.schoolId)).limit(1);
  if (!user) return null;
  return { name: user.name, email: user.email ?? "", schoolName: school?.name ?? "your school", role: m?.role ?? "teacher", employmentType: sp.employmentType, jobRole: sp.jobRole, isClassTeacher: sp.isClassTeacher, assignedClass: sp.assignedClass, subjects: (sp.subjects as string[]) ?? [], teachingClasses: (sp.teachingClasses as string[]) ?? [] };
}

type Personal = { phone?: string; address?: string; dob?: string; emergencyName?: string; emergencyRelationship?: string; emergencyPhone?: string };

// Sets the password, saves personal info, activates the staff profile, consumes the token,
// and signs the staff member in (cookie set via the nextCookies plugin).
export async function acceptInvite(token: string, password: string, personal: Personal): Promise<{ ok: true } | { error: string }> {
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const [sp] = await db.select().from(staffProfiles).where(eq(staffProfiles.inviteToken, token)).limit(1);
  if (!sp) return { error: "This invitation link is invalid or has already been used." };
  if (sp.inviteTokenExpiresAt && sp.inviteTokenExpiresAt.getTime() < Date.now()) return { error: "This invitation link has expired. Ask your admin to send a new one." };
  const [user] = await db.select().from(users).where(eq(users.id, sp.userId)).limit(1);
  if (!user?.email) return { error: "We couldn't find your account." };
  try {
    const hash = await hashPassword(password);
    await db.update(accounts).set({ password: hash, updatedAt: new Date() }).where(and(eq(accounts.userId, sp.userId), eq(accounts.providerId, "credential")));
    await db.update(staffProfiles).set({ status: "active", inviteToken: null, inviteTokenExpiresAt: null, profile: personal, updatedAt: new Date() }).where(eq(staffProfiles.id, sp.id));
    await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.id, sp.userId));
    // Trust the device the staffer onboarded on, so they can sign in from it without admin approval.
    await trustDevice(sp.schoolId, sp.userId, await getOrCreateDeviceId(), await deviceLabel(), null);
    await logAudit({ schoolId: sp.schoolId, actorUserId: sp.userId, action: "staff.joined", entityType: "Staff", entityId: sp.userId, metadata: { name: user.name } });
    await auth.api.signInEmail({ body: { email: user.email, password, rememberMe: false }, headers: await headers() });
    return { ok: true };
  } catch {
    return { error: "Could not complete your setup. Please try again." };
  }
}

// Photo upload for the signed-in staff member (after acceptInvite).
export async function uploadStaffPhoto(form: FormData): Promise<{ ok: true; url: string } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Please finish setting your password first." };
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Please choose an image." };
  if (file.size > 5_000_000) return { error: "Image must be under 5MB." };
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniffImage(buf);
  if (!ext) return { error: "That file isn't a supported image (PNG, JPG, GIF or WebP)." };
  try {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filename = `user-${session.user.id}.${ext}`;
    await writeFile(path.join(dir, filename), buf);
    const url = `/uploads/${filename}`;
    await db.update(users).set({ image: url, updatedAt: new Date() }).where(eq(users.id, session.user.id));
    return { ok: true, url };
  } catch {
    return { error: "Could not upload your photo. Please try again." };
  }
}
