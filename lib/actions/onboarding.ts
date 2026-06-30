"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomInt } from "crypto";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accounts, memberships, schools, staffProfiles, users } from "@/db/schema";
import { hashPassword } from "./people";
import { logAudit } from "@/lib/audit";
import { getOrCreateDeviceId, trustDevice, deviceLabel } from "@/lib/device-trust";
import { sniffImage } from "@/lib/image-upload";
import { sendEmail } from "@/lib/email";
import { isLockedOut, recordFailure, clearFailures } from "@/lib/rate-limit";

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

// Emails a one-time code to the invited address. The acceptor must enter it, proving they control the
// mailbox — so a leaked/forwarded invite link alone can't complete onboarding and take over the account.
export async function sendInviteOtp(token: string): Promise<{ ok: true } | { error: string }> {
  if (!token) return { error: "Invalid invitation." };
  const [sp] = await db.select().from(staffProfiles).where(eq(staffProfiles.inviteToken, token)).limit(1);
  if (!sp) return { error: "This invitation link is invalid or has already been used." };
  if (sp.inviteTokenExpiresAt && sp.inviteTokenExpiresAt.getTime() < Date.now()) return { error: "This invitation link has expired. Ask your admin to send a new one." };
  const sendKey = [`inviteotp-send:${token}`];
  if (await isLockedOut(sendKey)) return { error: "Too many code requests. Please wait a few minutes, then try again." };
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, sp.userId)).limit(1);
  if (!user?.email) return { error: "We couldn't find your account email." };
  const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.update(staffProfiles).set({ inviteOtpHash: await bcrypt.hash(otp, 10), inviteOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000), updatedAt: new Date() }).where(eq(staffProfiles.id, sp.id));
  await recordFailure(sendKey);
  void sendEmail({ to: user.email, subject: "Your Edumod sign-up code", text: `Your Edumod verification code is ${otp}\n\nEnter it to finish setting up your account. It expires in 10 minutes. If you didn't request this, you can ignore this email.` }).catch((e) => console.error("[email] invite OTP send failed:", e));
  return { ok: true };
}

// Sets the password, saves personal info, activates the staff profile, consumes the token,
// and signs the staff member in (cookie set via the nextCookies plugin). Requires the emailed OTP.
export async function acceptInvite(token: string, password: string, personal: Personal, otp: string): Promise<{ ok: true } | { error: string }> {
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!/^\d{6}$/.test(otp || "")) return { error: "Enter the 6-digit code we emailed you." };
  const [sp] = await db.select().from(staffProfiles).where(eq(staffProfiles.inviteToken, token)).limit(1);
  if (!sp) return { error: "This invitation link is invalid or has already been used." };
  if (sp.inviteTokenExpiresAt && sp.inviteTokenExpiresAt.getTime() < Date.now()) return { error: "This invitation link has expired. Ask your admin to send a new one." };
  const verifyKey = [`inviteotp-verify:${token}`];
  if (await isLockedOut(verifyKey)) return { error: "Too many incorrect codes. Please request a new code." };
  if (!sp.inviteOtpHash || !sp.inviteOtpExpiresAt || sp.inviteOtpExpiresAt.getTime() < Date.now()) return { error: "Your code has expired. Please request a new one." };
  if (!(await bcrypt.compare(otp, sp.inviteOtpHash))) { await recordFailure(verifyKey); return { error: "That code isn't right. Check your email and try again." }; }
  await clearFailures(verifyKey);
  const [user] = await db.select().from(users).where(eq(users.id, sp.userId)).limit(1);
  if (!user?.email) return { error: "We couldn't find your account." };
  try {
    const hash = await hashPassword(password);
    await db.update(accounts).set({ password: hash, updatedAt: new Date() }).where(and(eq(accounts.userId, sp.userId), eq(accounts.providerId, "credential")));
    await db.update(staffProfiles).set({ status: "active", inviteToken: null, inviteTokenExpiresAt: null, inviteOtpHash: null, inviteOtpExpiresAt: null, profile: personal, updatedAt: new Date() }).where(eq(staffProfiles.id, sp.id));
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
