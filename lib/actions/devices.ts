"use server";

import { headers } from "next/headers";
import { and, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, trustedDevices, users } from "@/db/schema";
import { logAudit } from "@/lib/audit";

const APPROVER_ROLES = ["school_admin", "principal", "vice_principal"];

async function ctx() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const [m] = await db.select({ schoolId: memberships.schoolId, role: memberships.role }).from(memberships).where(eq(memberships.userId, s.user.id)).limit(1);
  if (!m) return null;
  return { userId: s.user.id, schoolId: m.schoolId, role: m.role };
}

export type DeviceRow = { id: string; userId: string; staffName: string; label: string | null; status: string; lastSeenAt: string | null; createdAt: string };

// Devices for the school, newest first. Pending ones are what an admin needs to act on.
export async function listDevices(): Promise<{ pending: DeviceRow[]; approved: DeviceRow[] } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (!APPROVER_ROLES.includes(c.role)) return { error: "Only an admin can manage device approvals." };
  const rows = await db.select({ id: trustedDevices.id, userId: trustedDevices.userId, name: users.name, label: trustedDevices.label, status: trustedDevices.status, lastSeenAt: trustedDevices.lastSeenAt, createdAt: trustedDevices.createdAt })
    .from(trustedDevices).innerJoin(users, eq(users.id, trustedDevices.userId))
    .where(and(eq(trustedDevices.schoolId, c.schoolId), inArray(trustedDevices.status, ["pending", "approved"])))
    .orderBy(desc(trustedDevices.createdAt));
  const map = (r: typeof rows[number]): DeviceRow => ({ id: r.id, userId: r.userId, staffName: r.name, label: r.label, status: r.status, lastSeenAt: r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString() : null, createdAt: new Date(r.createdAt).toLocaleString() });
  return { pending: rows.filter((r) => r.status === "pending").map(map), approved: rows.filter((r) => r.status === "approved").map(map) };
}

async function setStatus(id: string, status: "approved" | "revoked", action: string): Promise<{ ok: true } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (!APPROVER_ROLES.includes(c.role)) return { error: "Only an admin can manage device approvals." };
  const [dev] = await db.select({ id: trustedDevices.id, userId: trustedDevices.userId }).from(trustedDevices).where(and(eq(trustedDevices.id, id), eq(trustedDevices.schoolId, c.schoolId))).limit(1);
  if (!dev) return { error: "Device not found." };
  await db.update(trustedDevices).set({ status, approvedByUserId: status === "approved" ? c.userId : null, approvedAt: status === "approved" ? new Date() : null, updatedAt: new Date() }).where(eq(trustedDevices.id, id));
  await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action, entityType: "Device", entityId: id, metadata: { forUserId: dev.userId } });
  return { ok: true };
}

export async function approveDevice(id: string) { return setStatus(id, "approved", "device.approved"); }
export async function revokeDevice(id: string) { return setStatus(id, "revoked", "device.revoked"); }
export async function rejectDevice(id: string) { return setStatus(id, "revoked", "device.rejected"); }
