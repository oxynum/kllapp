import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });
  }
  return redis;
}

const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX = 10;

/**
 * Redis-based rate limiter. Falls back to allowing the request if Redis is unavailable.
 */
export async function isRateLimitedRedis(ip: string): Promise<boolean> {
  const client = getRedis();
  if (!client) return false; // no Redis = allow (fallback to in-memory handled by caller)

  try {
    const key = `rl:${ip}`;
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, RATE_LIMIT_WINDOW);
    }
    return count > RATE_LIMIT_MAX;
  } catch {
    return false; // on error, allow the request
  }
}
