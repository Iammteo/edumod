import Redis from "ioredis";

// Per-account + per-IP login lockout. Student IDs are enumerable (school code + sequential ID),
// so the password is the only secret - this caps brute-force attempts. Backed by Redis; if Redis
// is unavailable it fails OPEN (never blocks a legitimate login) and just logs.
const MAX_ATTEMPTS = 5; // failures allowed within the window
const WINDOW_SECONDS = 15 * 60; // 15-minute rolling lockout

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
