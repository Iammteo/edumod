import Redis from "ioredis";

// Redis is REQUIRED in production: it backs the login/PIN lockout, auth rate limiting and one-time QR
// tokens. Without it these fail OPEN (no brute-force protection), so refuse to run a prod server that
// lacks it. The NEXT_PHASE guard avoids tripping `next build` (which sets NODE_ENV=production); this
// throws only at runtime, and a transient Redis outage still fails open below (availability > lockout).
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build" && !process.env.REDIS_URL) {
  throw new Error("REDIS_URL is required in production — it backs login lockout, rate limiting and one-time QR clock-in tokens. Set REDIS_URL before deploying.");
}

// Per-account + per-IP login lockout. Student IDs are enumerable (school code + sequential ID),
// so the password is the only secret - this caps brute-force attempts. Backed by Redis; if Redis
// is unavailable it fails OPEN (never blocks a legitimate login) and just logs.
export const MAX_ATTEMPTS = 5; // failures allowed within the window
export const LOCKOUT_MINUTES = 5; // how long the lockout lasts
const WINDOW_SECONDS = LOCKOUT_MINUTES * 60;

const globalForRedis = globalThis as unknown as { rateLimitRedis?: Redis | null };

function redis(): Redis | null {
  if (globalForRedis.rateLimitRedis !== undefined) return globalForRedis.rateLimitRedis;
  if (!process.env.REDIS_URL) return (globalForRedis.rateLimitRedis = null);
  try {
    globalForRedis.rateLimitRedis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: false });
  } catch {
    globalForRedis.rateLimitRedis = null;
  }
  return globalForRedis.rateLimitRedis;
}

export async function isLockedOut(keys: string[]): Promise<boolean> {
  const r = redis();
  if (!r) return false;
  try {
    for (const key of keys) {
      const count = Number(await r.get(`rl:${key}`)) || 0;
      if (count >= MAX_ATTEMPTS) return true;
    }
  } catch (e) {
    console.error("[rate-limit] check failed (failing open):", e);
  }
  return false;
}

export async function recordFailure(keys: string[]): Promise<void> {
  const r = redis();
  if (!r) return;
  try {
    for (const key of keys) {
      const n = await r.incr(`rl:${key}`);
      if (n === 1) await r.expire(`rl:${key}`, WINDOW_SECONDS);
    }
  } catch (e) {
    console.error("[rate-limit] record failed:", e);
  }
}

export async function clearFailures(keys: string[]): Promise<void> {
  const r = redis();
  if (!r) return;
  try {
    await r.del(...keys.map((k) => `rl:${k}`));
  } catch (e) {
    console.error("[rate-limit] clear failed:", e);
  }
}

// Single-use guard: returns true the FIRST time a key is seen within ttl, false on any repeat. Used to
// make rotating QR clock-in tokens one-shot so a shared/photographed code can't be reused. Fails OPEN
// (returns true) when Redis is unavailable, so legitimate clock-ins are never blocked.
export async function consumeOnce(key: string, ttlSeconds: number): Promise<boolean> {
  const r = redis();
  if (!r) return true;
  try {
    const ok = await r.set(`once:${key}`, "1", "EX", ttlSeconds, "NX");
    return ok === "OK";
  } catch (e) {
    console.error("[rate-limit] consumeOnce failed (failing open):", e);
    return true;
  }
}
