import { Redis } from 'ioredis';
import type { Request, Response, NextFunction } from 'express';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6380', 10),
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
});

const WINDOW_SIZE_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;

/**
 * Rate limiter middleware
 *
 * Uses Redis atomic counters to track requests per IP within a time window.
 * Returns 429 Too Many Requests when the limit is exceeded.
 */
export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // This aligns requests to fixed windows based on the current minute.
  // Each window gets its own Redis key with an EXPIRE.
  const windowStart = Math.floor(now / WINDOW_SIZE_MS) * WINDOW_SIZE_MS;
  const key = `ratelimit:${ip}:${windowStart}`;

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      // Set expiry on the first request in the window
      await redis.pexpire(key, WINDOW_SIZE_MS);
    }

    const ttl = await redis.pttl(key);
    const effectiveTtl = ttl > 0 ? ttl : WINDOW_SIZE_MS;
    const resetTime = now + effectiveTtl;

    // RateLimit headers
    res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, MAX_REQUESTS - current)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetTime / 1000)));

    if (current > MAX_REQUESTS) {
      res.setHeader('Retry-After', String(Math.ceil(effectiveTtl / 1000)));
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil(effectiveTtl / 1000)} seconds.`,
      });
    }

    next();
  } catch (err) {
    // Fail open if Redis is unavailable
    console.error('Rate limiter Redis error:', err);
    next();
  }
}
