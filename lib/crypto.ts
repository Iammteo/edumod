import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// AES-256-GCM at-rest encryption for low-sensitivity, recoverable secrets — specifically the
// school-assigned STUDENT login password, so an admin can view it without a reset. NEVER use this
// for staff/admin credentials (those stay one-way bcrypt-hashed).
const KEY = createHash("sha256").update(process.env.STUDENT_CRED_SECRET || process.env.BETTER_AUTH_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-cred-secret")).digest();
if (KEY.length !== 32) throw new Error("Set STUDENT_CRED_SECRET or BETTER_AUTH_SECRET to encrypt student credentials.");

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64"); // iv(12) | tag(16) | ciphertext
}

export function decryptSecret(blob: string | null | undefined): string | null {
  if (!blob) return null;
  try {
    const raw = Buffer.from(blob, "base64");
    const d = createDecipheriv("aes-256-gcm", KEY, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
