import { createHmac, timingSafeEqual } from "node:crypto";

// HMAC-signed, time-stamped token for the rotating kiosk QR. The secret lives only on the server,
// so a teacher's phone can't forge a token — and because it carries a server timestamp, the
// clock-in action can reject anything older than the grace window (replay / shared-screenshot guard).
const SECRET = process.env.ATTENDANCE_QR_SECRET || process.env.BETTER_AUTH_SECRET || "dev-attendance-secret-change-me";
const b64url = (b: Buffer) => b.toString("base64url");

export function signQrToken(now = Date.now()): string {
  const payload = b64url(Buffer.from(JSON.stringify({ ts: now })));
  const sig = b64url(createHmac("sha256", SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

// Returns the embedded timestamp if the signature is valid, else null. Constant-time compare.
export function verifyQrToken(token: string): { ts: number } | null {
  const [payload, sig] = (token || "").split(".");
  if (!payload || !sig) return null;
  const expected = b64url(createHmac("sha256", SECRET).update(payload).digest());
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { ts } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof ts === "number" ? { ts } : null;
  } catch {
    return null;
  }
}
