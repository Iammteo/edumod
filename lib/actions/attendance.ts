"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { headers } from "next/headers";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memberships, schools, staffProfiles, teacherAttendanceLogs, users } from "@/db/schema";
import { signQrToken, verifyQrToken } from "@/lib/attendance-token";
import { attendanceUploadQueue } from "@/lib/queues";
import { logAudit } from "@/lib/audit";
import { consumeOnce, isLockedOut, recordFailure, clearFailures } from "@/lib/rate-limit";

const QR_GRACE_MS = 10_000; // 10s window to tolerate local cellular latency
const STAFF_ROLES = ["teacher", "principal", "vice_principal", "secretary", "school_admin"];
const ACCESS_DISABLED = "Your staff access is inactive. Please contact your school admin.";
// Only leadership can run the attendance terminal (it lives on a dedicated admin device). Teachers
// clock in *at* it (PIN/QR) but can't open it themselves.
const ADMIN_TERMINAL_ROLES = ["school_admin", "principal", "vice_principal"];
// A null status means no staff profile (e.g. the owner-admin) — only an explicit non-active profile is blocked.
const isActive = (status: string | null | undefined) => !status || status === "active";

async function ctx() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const [m] = await db.select({ schoolId: memberships.schoolId, role: memberships.role, status: staffProfiles.status, tz: schools.timezone })
    .from(memberships)
    .innerJoin(schools, eq(schools.id, memberships.schoolId))
    .leftJoin(staffProfiles, and(eq(staffProfiles.userId, memberships.userId), eq(staffProfiles.schoolId, memberships.schoolId)))
    .where(eq(memberships.userId, s.user.id)).limit(1);
  if (!m) return null;
  return { userId: s.user.id, schoolId: m.schoolId, role: m.role, status: m.status, tz: m.tz || "Africa/Lagos" };
}

// Midnight "today" in the school's timezone, as a UTC instant — so a late-night clock-in is counted
// on the correct local day even when the server runs in UTC.
function startOfTodayTz(tz: string): Date {
  const now = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const asUTC = new Date(`${ymd}T00:00:00Z`);
  const offsetMs = new Date(now.toLocaleString("en-US", { timeZone: tz })).getTime() - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(asUTC.getTime() - offsetMs);
}

const r2Configured = () => !!process.env.R2_ACCOUNT_ID && !!process.env.R2_ACCESS_KEY_ID && !!process.env.R2_BUCKET;

// Fallback when R2/queue aren't configured (local/dev): write the selfie to private-uploads (NOT
// /public — selfies are staff PII) and store the bare filename. Served via /api/attendance-photo.
async function saveSelfieLocally(dataUrl: string, logId: string): Promise<string | null> {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  const ext = (m[1].split("/")[1] || "jpg").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
  const dir = path.join(process.cwd(), "private-uploads", "attendance");
  await mkdir(dir, { recursive: true });
  const name = `${logId}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(m[2], "base64"));
  return name;
}

// Resolve a stored snapshot value to a servable URL: R2 uploads are already absolute URLs; local
// selfies are bare filenames served through the auth-gated route.
const snapshotUrlFor = (logId: string, stored: string | null) => (stored ? (/^https?:\/\//.test(stored) ? stored : `/api/attendance-photo/${logId}`) : null);

// Clock-in unless the teacher's last action today was already a clock-in (then it's a clock-out).
async function nextDirection(teacherId: string, schoolId: string, tz: string): Promise<"clock_in" | "clock_out"> {
  const [last] = await db.select({ direction: teacherAttendanceLogs.direction }).from(teacherAttendanceLogs)
    .where(and(eq(teacherAttendanceLogs.teacherId, teacherId), eq(teacherAttendanceLogs.schoolId, schoolId), gte(teacherAttendanceLogs.timestamp, startOfTodayTz(tz))))
    .orderBy(desc(teacherAttendanceLogs.timestamp)).limit(1);
  return last?.direction === "clock_in" ? "clock_out" : "clock_in";
}

// ---- Attendance dashboard data (today's clock-ins, who's present) ----------------------------
export type AttendanceLog = { id: string; teacher: string; direction: "clock_in" | "clock_out"; method: string; time: string; snapshotUrl: string | null };
export type AttendanceData = { logs: AttendanceLog[]; staffTotal: number; clockedIn: number; present: number; myPinSet: boolean; canManage: boolean };

export async function getAttendanceData(): Promise<AttendanceData | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (!STAFF_ROLES.includes(c.role)) return { error: "Not authorised." };
  const [rows, staffCount, mine] = await Promise.all([
    db.select({ id: teacherAttendanceLogs.id, teacherId: teacherAttendanceLogs.teacherId, name: users.name, direction: teacherAttendanceLogs.direction, method: teacherAttendanceLogs.verificationMethod, ts: teacherAttendanceLogs.timestamp, snapshotUrl: teacherAttendanceLogs.snapshotUrl })
      .from(teacherAttendanceLogs).innerJoin(users, eq(users.id, teacherAttendanceLogs.teacherId))
      .where(and(eq(teacherAttendanceLogs.schoolId, c.schoolId), gte(teacherAttendanceLogs.timestamp, startOfTodayTz(c.tz))))
      .orderBy(desc(teacherAttendanceLogs.timestamp)).limit(200),
    db.select({ n: sql<number>`count(*)::int` }).from(staffProfiles).where(eq(staffProfiles.schoolId, c.schoolId)),
    db.select({ pin: staffProfiles.gatePinHash }).from(staffProfiles).where(and(eq(staffProfiles.userId, c.userId), eq(staffProfiles.schoolId, c.schoolId))).limit(1),
  ]);
  const latest = new Map<string, "clock_in" | "clock_out">();
  for (const r of rows) if (!latest.has(r.teacherId)) latest.set(r.teacherId, r.direction); // desc order → first seen is latest
  let present = 0;
  for (const d of latest.values()) if (d === "clock_in") present++;
  return {
    logs: rows.map((r) => ({ id: r.id, teacher: r.name, direction: r.direction, method: r.method, time: new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), snapshotUrl: snapshotUrlFor(r.id, r.snapshotUrl) })),
    staffTotal: Number(staffCount[0]?.n ?? 0), clockedIn: latest.size, present, myPinSet: !!mine[0]?.pin, canManage: c.role === "school_admin",
  };
}

// ---- Teacher's own portal: status, history, set PIN, one-tap clock-in -----------------------
export type MyAttendance = { status: "in" | "out" | "none"; lastAt: string | null; pinSet: boolean; history: { direction: "clock_in" | "clock_out"; method: string; time: string; date: string }[] };

export async function getMyAttendance(): Promise<MyAttendance | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  const [todayRows, mine, recent] = await Promise.all([
    db.select({ direction: teacherAttendanceLogs.direction, ts: teacherAttendanceLogs.timestamp }).from(teacherAttendanceLogs).where(and(eq(teacherAttendanceLogs.teacherId, c.userId), gte(teacherAttendanceLogs.timestamp, startOfTodayTz(c.tz)))).orderBy(desc(teacherAttendanceLogs.timestamp)).limit(1),
    db.select({ pin: staffProfiles.gatePinHash }).from(staffProfiles).where(and(eq(staffProfiles.userId, c.userId), eq(staffProfiles.schoolId, c.schoolId))).limit(1),
    db.select({ direction: teacherAttendanceLogs.direction, method: teacherAttendanceLogs.verificationMethod, ts: teacherAttendanceLogs.timestamp }).from(teacherAttendanceLogs).where(eq(teacherAttendanceLogs.teacherId, c.userId)).orderBy(desc(teacherAttendanceLogs.timestamp)).limit(10),
  ]);
  const last = todayRows[0];
  return {
    status: !last ? "none" : last.direction === "clock_in" ? "in" : "out",
    lastAt: last ? new Date(last.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null,
    pinSet: !!mine[0]?.pin,
    history: recent.map((r) => ({ direction: r.direction, method: r.method, time: new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), date: new Date(r.ts).toLocaleDateString() })),
  };
}

// Self-portal clock-in is intentionally disabled: it let staff clock in from anywhere with no
// presence check (buddy-punching). Staff must scan the terminal's live QR code instead, which binds
// the clock-in to being physically at the terminal. Kept as a guarded stub so any stale caller fails
// closed rather than recording an unverified entry.
export async function selfClockIn(): Promise<{ ok: true; direction: "clock_in" | "clock_out"; at: string } | { error: string }> {
  return { error: "Clock in by scanning the live QR code on the staff terminal." };
}

// ---- Printable teacher clock-in register (by day or week) ------------------------------------
const ROLE_LABEL: Record<string, string> = { school_admin: "Admin", principal: "Principal", vice_principal: "Vice principal", teacher: "Teacher", secretary: "Secretary" };
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function daysInRange(from: string, to: string): string[] {
  const out: string[] = []; let d = new Date(from + "T00:00"); const end = new Date(to + "T00:00");
  for (let i = 0; i < 40 && d <= end; i++) { out.push(isoDay(d)); d = new Date(d.getTime() + 864e5); }
  return out;
}
export type TeacherAttnReportRow = { date: string; name: string; role: string; timeIn: string; timeOut: string; method: string; status: string; snapshot: string | null };
export async function getTeacherAttendanceReport(from: string, to: string): Promise<TeacherAttnReportRow[] | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  if (!["school_admin", "principal", "vice_principal"].includes(c.role)) return { error: "Only an admin can export staff attendance." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: "Invalid date range." };
  const days = daysInRange(from, to);
  const [staff, logs, [school]] = await Promise.all([
    db.select({ id: users.id, name: users.name, role: memberships.role }).from(staffProfiles).innerJoin(users, eq(users.id, staffProfiles.userId)).innerJoin(memberships, and(eq(memberships.userId, staffProfiles.userId), eq(memberships.schoolId, c.schoolId))).where(eq(staffProfiles.schoolId, c.schoolId)).orderBy(users.name),
    db.select({ teacherId: teacherAttendanceLogs.teacherId, direction: teacherAttendanceLogs.direction, method: teacherAttendanceLogs.verificationMethod, ts: teacherAttendanceLogs.timestamp, snapshot: teacherAttendanceLogs.snapshotUrl }).from(teacherAttendanceLogs).where(and(eq(teacherAttendanceLogs.schoolId, c.schoolId), gte(teacherAttendanceLogs.timestamp, new Date(from + "T00:00:00")), lte(teacherAttendanceLogs.timestamp, new Date(to + "T23:59:59")))),
    db.select({ dayStartsAt: schools.dayStartsAt, dayEndsAt: schools.dayEndsAt }).from(schools).where(eq(schools.id, c.schoolId)).limit(1),
  ]);
  const toMin = (hhmm: string | null | undefined) => { if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null; const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const startMin = toMin(school?.dayStartsAt), endMin = toMin(school?.dayEndsAt);
  const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
  const key = (tid: string, day: string) => `${tid}|${day}`;
  const byKey = new Map<string, typeof logs>();
  for (const l of logs) { const k = key(l.teacherId, isoDay(new Date(l.ts))); (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(l); }
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const rows: TeacherAttnReportRow[] = [];
  for (const day of days) for (const s of staff) {
    const ls = byKey.get(key(s.id, day)) ?? [];
    const ins = ls.filter((l) => l.direction === "clock_in").sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
    const outs = ls.filter((l) => l.direction === "clock_out").sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
    let status = "Absent";
    if (ins.length) {
      const inMin = minutesOf(new Date(ins[0].ts));
      status = startMin !== null && inMin > startMin ? "Late" : "On time";
      if (endMin !== null && outs.length) { const outMin = minutesOf(new Date(outs[outs.length - 1].ts)); if (outMin < endMin) status += " · left early"; }
    }
    rows.push({
      date: day, name: s.name, role: ROLE_LABEL[s.role] ?? s.role,
      timeIn: ins[0] ? fmt(new Date(ins[0].ts)) : "-", timeOut: outs.length ? fmt(new Date(outs[outs.length - 1].ts)) : "-",
      method: ins[0] ? ({ qr_scan: "QR", kiosk_pin: "PIN", self_portal: "Portal", admin_override: "Override" }[ins[0].method] ?? ins[0].method) : "-",
      status,
      snapshot: ls.find((l) => l.snapshot)?.snapshot ?? null, // selfie may be on the clock-out log
    });
  }
  return rows;
}

// ---- Rotating QR — the terminal must be signed into the school; the token is bound to that school.
export async function getQrToken(): Promise<{ token: string } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Sign this terminal in to your school to show the clock-in code." };
  if (!ADMIN_TERMINAL_ROLES.includes(c.role)) return { error: "Only an admin can open the attendance terminal. Sign in on the school's admin device." };
  return { token: signQrToken(c.schoolId) };
}

const qrSchema = z.object({ token: z.string().min(10) });
export async function handleQrClockIn(input: { token: string }): Promise<{ ok: true; direction: "clock_in" | "clock_out"; at: string } | { error: string }> {
  const parsed = qrSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid QR payload." };
  const c = await ctx();
  if (!c) return { error: "Sign in on your phone, then scan again." };
  if (!STAFF_ROLES.includes(c.role)) return { error: "Only staff can clock in." };
  if (!isActive(c.status)) return { error: ACCESS_DISABLED };

  const decoded = verifyQrToken(parsed.data.token);
  if (!decoded) return { error: "Invalid or tampered code. Scan the live code on the terminal." };
  if (decoded.sid !== c.schoolId) return { error: "That code belongs to a different school's terminal." };
  const drift = Date.now() - decoded.ts;
  if (Math.abs(drift) > QR_GRACE_MS) return { error: "That code has expired. Scan the current code on the terminal." };
  // One-shot: a given displayed code can be redeemed once, so a photographed/forwarded code can't be
  // re-used by an absent colleague within the grace window (anti-buddy-punching).
  if (!(await consumeOnce(`qr:${parsed.data.token}`, Math.ceil(QR_GRACE_MS / 1000) + 1))) return { error: "That code was already used. Scan the current code on the terminal." };

  try {
    const direction = await nextDirection(c.userId, c.schoolId, c.tz);
    await db.insert(teacherAttendanceLogs).values({ schoolId: c.schoolId, teacherId: c.userId, direction, verificationMethod: "qr_scan" });
    await logAudit({ schoolId: c.schoolId, actorUserId: c.userId, action: `attendance.${direction}`, entityType: "Attendance", metadata: { method: "qr_scan" } });
    return { ok: true, direction, at: new Date().toLocaleTimeString() };
  } catch {
    return { error: "Could not record your clock-in. Please try again." };
  }
}

// ---- Teacher sets their own 6-digit clock-in PIN (stored on the staff profile, bcrypt) -------
const pinSchema = z.object({ pin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits.") });
export async function setClockInPin(input: { pin: string }): Promise<{ ok: true } | { error: string }> {
  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid PIN." };
  const c = await ctx();
  if (!c) return { error: "Not authorised." };
  const [sp] = await db.select({ id: staffProfiles.id }).from(staffProfiles).where(and(eq(staffProfiles.userId, c.userId), eq(staffProfiles.schoolId, c.schoolId))).limit(1);
  if (!sp) return { error: "Only staff can set a clock-in PIN." };
  await db.update(staffProfiles).set({ gatePinHash: await bcrypt.hash(parsed.data.pin, 10), updatedAt: new Date() }).where(eq(staffProfiles.id, sp.id));
  return { ok: true };
}

// ---- Kiosk: teacher name-picker (runs under the terminal's school session) -------------------
export async function getKioskTeachers(): Promise<{ id: string; name: string; hasPin: boolean }[]> {
  const c = await ctx();
  if (!c || !ADMIN_TERMINAL_ROLES.includes(c.role)) return [];
  const rows = await db.select({ id: users.id, name: users.name, pin: staffProfiles.gatePinHash })
    .from(staffProfiles).innerJoin(users, eq(users.id, staffProfiles.userId))
    .where(eq(staffProfiles.schoolId, c.schoolId)).orderBy(users.name);
  return rows.map((r) => ({ id: r.id, name: r.name, hasPin: !!r.pin }));
}

// ---- Kiosk PIN + selfie: save the log NOW, queue the upload, return instantly ----------------
const kioskSchema = z.object({
  teacherId: z.string().min(1),
  pin: z.string().regex(/^\d{6}$/),
  snapshot: z.string().startsWith("data:image/").max(4_000_000), // ~3 MB base64 cap
});
export async function handleKioskPinClockIn(input: { teacherId: string; pin: string; snapshot: string }): Promise<{ ok: true; direction: "clock_in" | "clock_out"; teacher: string } | { error: string }> {
  const parsed = kioskSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid submission." };
  const c = await ctx();
  if (!c) return { error: "Terminal not authorised. Sign the tablet in to the school." };
  if (!ADMIN_TERMINAL_ROLES.includes(c.role)) return { error: "This device isn't an admin terminal." };
  const { teacherId, pin, snapshot } = parsed.data;

  const [row] = await db.select({ name: users.name, pin: staffProfiles.gatePinHash, status: staffProfiles.status }).from(staffProfiles).innerJoin(users, eq(users.id, staffProfiles.userId))
    .where(and(eq(staffProfiles.userId, teacherId), eq(staffProfiles.schoolId, c.schoolId))).limit(1);
  if (!row?.pin) return { error: "No PIN set for this teacher yet." };
  if (!isActive(row.status)) return { error: "This staff member's access is inactive." };
  // Cap PIN guessing per teacher/terminal (6-digit PIN = 1M space) — without this a terminal operator
  // could brute-force a colleague's PIN.
  const pinKeys = [`kioskpin:${c.schoolId}:${teacherId}`];
  if (await isLockedOut(pinKeys)) return { error: "Too many incorrect PIN attempts. Please try again later." };
  if (!(await bcrypt.compare(pin, row.pin))) { await recordFailure(pinKeys); return { error: "Incorrect PIN." }; }
  await clearFailures(pinKeys);

  try {
    const direction = await nextDirection(teacherId, c.schoolId, c.tz);
    const [log] = await db.insert(teacherAttendanceLogs).values({ schoolId: c.schoolId, teacherId, direction, verificationMethod: "kiosk_pin" }).returning({ id: teacherAttendanceLogs.id });
    if (r2Configured()) {
      // Production: offload the R2 upload so the tablet responds instantly on a slow network.
      await attendanceUploadQueue.add("upload", { logId: log.id, schoolId: c.schoolId, imageBase64: snapshot }, { attempts: 5, backoff: { type: "exponential", delay: 3000 }, removeOnComplete: 1000, removeOnFail: 500 })
        .catch((e) => console.error("[attendance] enqueue failed (log saved, snapshot deferred):", e));
    } else {
      // Local/dev: no R2 + worker, so persist the selfie directly (a small JPEG writes in a few ms).
      try {
        const url = await saveSelfieLocally(snapshot, log.id);
        if (url) await db.update(teacherAttendanceLogs).set({ snapshotUrl: url, updatedAt: new Date() }).where(eq(teacherAttendanceLogs.id, log.id));
      } catch (e) { console.error("[attendance] local selfie save failed:", e); }
    }
    await logAudit({ schoolId: c.schoolId, actorUserId: teacherId, action: `attendance.${direction}`, entityType: "Attendance", metadata: { method: "kiosk_pin" } });
    return { ok: true, direction, teacher: row.name };
  } catch {
    return { error: "Could not record the clock-in. Please try again." };
  }
}
