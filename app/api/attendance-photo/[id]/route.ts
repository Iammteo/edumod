import { readFile } from "fs/promises";
import path from "path";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, teacherAttendanceLogs } from "@/db/schema";

const CONTENT_TYPE: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

// Auth-gated clock-in selfie download. Selfies are staff PII, so they live outside /public and are
// only served to a signed-in member of the same school. (id = the attendance log id.)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [log] = await db.select({ schoolId: teacherAttendanceLogs.schoolId, snapshotUrl: teacherAttendanceLogs.snapshotUrl }).from(teacherAttendanceLogs).where(eq(teacherAttendanceLogs.id, id)).limit(1);
  if (!log || !log.snapshotUrl) return new Response("Not found", { status: 404 });
  // R2 uploads are absolute URLs served by R2 directly, not here.
  if (/^https?:\/\//.test(log.snapshotUrl)) return new Response("Not found", { status: 404 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Forbidden", { status: 403 });
  const [m] = await db.select({ schoolId: memberships.schoolId }).from(memberships).where(and(eq(memberships.userId, session.user.id), eq(memberships.schoolId, log.schoolId))).limit(1);
  if (!m) return new Response("Forbidden", { status: 403 });

  try {
    const buf = await readFile(path.join(process.cwd(), "private-uploads", "attendance", log.snapshotUrl));
    const ext = (log.snapshotUrl.split(".").pop() || "").toLowerCase();
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": CONTENT_TYPE[ext] ?? "application/octet-stream", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
