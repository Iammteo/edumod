import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberships, trustedDevices } from "@/db/schema";

const DEVICE_COOKIE = "edu_device";
const ONE_YEAR = 60 * 60 * 24 * 365;

// The device id is a high-entropy opaque token stored in an httpOnly cookie. Knowing it is the only
// way to match an approved device row, so it can't be guessed or forged from the client.
export async function getOrCreateDeviceId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(DEVICE_COOKIE)?.value;
  if (existing && existing.length >= 16) return existing;
  const id = randomUUID();
  jar.set(DEVICE_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: ONE_YEAR });
  return id;
}

// Read-only variant for the auth session hook (which must NOT set cookies — a thrown block would
// drop the Set-Cookie and mint a fresh id every attempt). The login page sets the cookie on load.
export async function readDeviceId(): Promise<string | null> {
  const v = (await cookies()).get(DEVICE_COOKIE)?.value;
  return v && v.length >= 16 ? v : null;
}

// A friendly label for the approvals UI, derived from the user agent (best-effort).
export async function deviceLabel(): Promise<string> {
  const ua = (await headers()).get("user-agent") || "";
  const os = /iphone|ipad|ipod/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "Mac" : /linux/i.test(ua) ? "Linux" : "Device";
  const browser = /edg\//i.test(ua) ? "Edge" : /chrome\//i.test(ua) ? "Chrome" : /firefox\//i.test(ua) ? "Firefox" : /safari\//i.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}

export type DeviceStatus = "approved" | "pending" | "revoked" | "new";

export async function deviceStatus(userId: string, deviceId: string): Promise<DeviceStatus> {
  const [row] = await db.select({ status: trustedDevices.status }).from(trustedDevices).where(and(eq(trustedDevices.userId, userId), eq(trustedDevices.deviceId, deviceId))).limit(1);
  return (row?.status as DeviceStatus) ?? "new";
}

// Record a device as pending for approval. If a row already exists (e.g. it was revoked/rejected),
// flip it back to pending and clear any prior approval so it re-enters the admin's queue.
export async function recordPendingDevice(schoolId: string, userId: string, deviceId: string, label: string): Promise<void> {
  await db.insert(trustedDevices).values({ schoolId, userId, deviceId, label, status: "pending", lastSeenAt: new Date() })
    .onConflictDoUpdate({ target: [trustedDevices.userId, trustedDevices.deviceId], set: { status: "pending", approvedByUserId: null, approvedAt: null, lastSeenAt: new Date() } });
}

// Mark a device approved (used for the auto-trusted first device at invite acceptance).
export async function trustDevice(schoolId: string, userId: string, deviceId: string, label: string, approvedByUserId: string | null): Promise<void> {
  await db.insert(trustedDevices).values({ schoolId, userId, deviceId, label, status: "approved", approvedByUserId, approvedAt: new Date(), lastSeenAt: new Date() })
    .onConflictDoUpdate({ target: [trustedDevices.userId, trustedDevices.deviceId], set: { status: "approved", approvedByUserId, approvedAt: new Date(), lastSeenAt: new Date() } });
}

export async function touchDevice(userId: string, deviceId: string): Promise<void> {
  await db.update(trustedDevices).set({ lastSeenAt: new Date() }).where(and(eq(trustedDevices.userId, userId), eq(trustedDevices.deviceId, deviceId)));
}

// True if the staffer has ever registered a device. Used for enroll-on-first-use: the very first
// device a staffer signs in from is trusted automatically; every device after that needs approval.
export async function userHasAnyDevice(userId: string): Promise<boolean> {
  const [row] = await db.select({ id: trustedDevices.id }).from(trustedDevices).where(eq(trustedDevices.userId, userId)).limit(1);
  return !!row;
}

// Single source of truth for the staff device-trust decision, shared by the Staff-ID login action
// and the auth session hook (which covers email/social logins). Admins and non-members are exempt.
// Side effects: stamps lastSeen on a known device, records a pending request for a new one, or
// auto-trusts the staffer's very first device (enroll-on-first-use).
export async function evaluateStaffDevice(userId: string, deviceId: string): Promise<{ allow: boolean; message?: string }> {
  const [m] = await db.select({ role: memberships.role, schoolId: memberships.schoolId }).from(memberships).where(eq(memberships.userId, userId)).limit(1);
  if (!m || m.role === "school_admin") return { allow: true };
  const status = await deviceStatus(userId, deviceId);
  if (status === "approved") { await touchDevice(userId, deviceId); return { allow: true }; }
  if (status === "pending") return { allow: false, message: "This device is waiting for admin approval. You can sign in once it's approved." };
  // A previously rejected/revoked device can ask again: re-queue it so an admin can reconsider.
  if (status === "revoked") {
    await recordPendingDevice(m.schoolId, userId, deviceId, await deviceLabel());
    return { allow: false, message: "This device was rejected before. We've sent your admin a fresh approval request - try again once they approve it." };
  }
  if (await userHasAnyDevice(userId)) {
    await recordPendingDevice(m.schoolId, userId, deviceId, await deviceLabel());
    return { allow: false, message: "New device detected. We've asked your admin to approve it - try again once they do." };
  }
  await trustDevice(m.schoolId, userId, deviceId, await deviceLabel(), null);
  return { allow: true };
}
