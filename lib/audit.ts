// Central audit-log writer. Every meaningful action calls this so the audit log, the recent-activity
// feed and the notification bell are populated from real events. Fire-and-forget: never throws into
// the caller (an audit failure must not break the underlying action).
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { auditLogs } from "@/db/schema";

export async function logAudit(entry: { schoolId: string; actorUserId: string | null; action: string; entityType: string; entityId?: string | null; metadata?: Record<string, unknown> }) {
  // Capture the request IP for security forensics. No-op outside a request scope (e.g. the worker).
  let ipAddress: string | null = null;
  try {
    const h = await headers();
    ipAddress = (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "").trim() || null;
  } catch { /* no request context */ }
  try {
    await db.insert(auditLogs).values({
      schoolId: entry.schoolId,
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? {},
      ipAddress,
    });
  } catch (e) {
    console.error("[audit] failed to write:", e);
  }
}
