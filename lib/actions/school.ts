"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { schools, memberships } from "@/db/schema";
import { logAudit } from "@/lib/audit";

async function adminCtx(): Promise<{ schoolId: string; userId: string } | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (!m || m.role !== "school_admin") return null;
  return { schoolId: m.schoolId, userId: session.user.id };
}
async function adminSchoolId(): Promise<string | null> {
  return (await adminCtx())?.schoolId ?? null;
}

export async function updateSchoolProfile(input: { name?: string; email?: string; phone?: string; state?: string; country?: string; address?: string; requireApproval?: boolean; currentSession?: string; currentTerm?: string; dayStartsAt?: string; dayEndsAt?: string }): Promise<{ ok: true } | { error: string }> {
  const ctx = await adminCtx();
  if (!ctx) return { error: "Only an admin can update the school." };
  const patch: Partial<typeof schools.$inferInsert> = {};
  if (input.name?.trim()) patch.name = input.name.trim();
  if (input.email?.trim()) patch.email = input.email.trim();
  if (input.phone?.trim()) patch.phone = input.phone.trim();
  if (input.state?.trim()) patch.state = input.state.trim();
  if (input.country?.trim()) patch.country = input.country.trim();
  if (input.address?.trim()) patch.address = input.address.trim();
  if (input.currentSession?.trim()) patch.currentSession = input.currentSession.trim();
  if (input.currentTerm?.trim()) patch.currentTerm = input.currentTerm.trim();
  if (typeof input.requireApproval === "boolean") patch.requireApproval = input.requireApproval;
  // School day hours ("HH:MM" or "" to clear) — used to flag Late / left-early on the staff register.
  for (const f of ["dayStartsAt", "dayEndsAt"] as const) {
    const v = input[f];
    if (v === undefined) continue;
    if (v === "") patch[f] = null;
    else if (/^\d{2}:\d{2}$/.test(v)) patch[f] = v;
    else return { error: "Times must be in HH:MM format." };
  }
  if (Object.keys(patch).length === 0) return { error: "Nothing to update." };
  try {
    await db.update(schools).set({ ...patch, updatedAt: new Date() }).where(eq(schools.id, ctx.schoolId));
    await logAudit({ schoolId: ctx.schoolId, actorUserId: ctx.userId, action: "settings.updated", entityType: "Settings", metadata: { fields: Object.keys(patch) } });
    return { ok: true };
  } catch {
    return { error: "Could not save your changes. Please try again." };
  }
}

export async function removeSchoolLogo(): Promise<{ ok: true } | { error: string }> {
  const schoolId = await adminSchoolId();
  if (!schoolId) return { error: "Only an admin can update the logo." };
  try {
    await db.update(schools).set({ logoKey: null, updatedAt: new Date() }).where(eq(schools.id, schoolId));
    return { ok: true };
  } catch {
    return { error: "Could not remove the logo." };
  }
}

export async function uploadSchoolLogo(form: FormData): Promise<{ ok: true; logoUrl: string } | { error: string }> {
  const schoolId = await adminSchoolId();
  if (!schoolId) return { error: "Only an admin can update the logo." };
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Please choose an image." };
  if (!file.type.startsWith("image/")) return { error: "That file isn't an image." };
  if (file.size > 2_000_000) return { error: "Image must be under 2MB." };
  const ext = (file.type.split("/")[1] || "png").replace(/[^a-z0-9]/g, "").replace("jpeg", "jpg");
  try {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filename = `school-${schoolId}.${ext}`;
    await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
    const logoKey = `/uploads/${filename}`;
    await db.update(schools).set({ logoKey, updatedAt: new Date() }).where(eq(schools.id, schoolId));
    return { ok: true, logoUrl: logoKey };
  } catch {
    return { error: "Could not upload the logo. Please try again." };
  }
}
