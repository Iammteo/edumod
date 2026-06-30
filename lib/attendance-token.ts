import { createHmac, timingSafeEqual } from "node:crypto";

// HMAC-signed, time-stamped token for the rotating kiosk QR. The secret lives only on the server,
// so a teacher's phone can't forge a token - and because it carries a server timestamp, the
// clock-in action can reject anything older than the grace window (replay / shared-screenshot guard).
// In production a real secret MUST be set, or QR tokens could be forged. Only fall back to a
// throwaway dev secret outside production.
const SECRET = process.env.ATTENDANCE_QR_SECRET || process.env.BETTER_AUTH_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-attendance-secret-change-me");
if (!SECRET) throw new Error("Set ATTENDANCE_QR_SECRET (or BETTER_AUTH_SECRET) — required to sign attendance QR tokens in production.");
const b64url = (b: Buffer) => b.toString("base64url");

// The token binds to a school, so a code minted at one school's terminal can't clock in staff at another.
export function signQrToken(schoolId: string, now = Date.now()): string {
  const payload = b64url(Buffer.from(JSON.stringify({ ts: now, sid: schoolId })));
  const sig = b64url(createHmac("sha256", SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

// Returns the embedded timestamp + school id if the signature is valid, else null. Constant-time compare.
export function verifyQrToken(token: string): { ts: number; sid: string } | null {
  const [payload, sig] = (token || "").split(".");
  if (!payload || !sig) return null;
  const expected = b64url(createHmac("sha256", SECRET).update(payload).digest());
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { ts, sid } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof ts === "number" && typeof sid === "string" ? { ts, sid } : null;
  } catch {
    return null;
  }
}
