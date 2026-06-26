"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { schools, memberships } from "@/db/schema";

async function adminSchoolId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const [m] = await db.select().from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  if (!m || m.role !== "school_admin") return null;
  return m.schoolId;
}

export async function updateSchoolProfile(input: { name?: string; email?: string; phone?: string; state?: string; country?: string; address?: string }): Promise<{ ok: true } | { error: string }> {
  const schoolId = await adminSchoolId();
  if (!schoolId) return { error: "Only an admin can update the school." };
  const patch: Partial<typeof schools.$inferInsert> = {};
  if (input.name?.trim()) patch.name = input.name.trim();
  if (input.email?.trim()) patch.email = input.email.trim();
  if (input.phone?.trim()) patch.phone = input.phone.trim();
  if (input.state?.trim()) patch.state = input.state.trim();
  if (input.country?.trim()) patch.country = input.country.trim();
  if (input.address?.trim()) patch.address = input.address.trim();
  if (Object.keys(patch).length === 0) return { error: "Nothing to update." };
  try {
    await db.update(schools).set({ ...patch, updatedAt: new Date() }).where(eq(schools.id, schoolId));
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
