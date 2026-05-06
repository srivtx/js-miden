import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { REDIS_URL, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from '../config.js';

const redis = new Redis(REDIS_URL);

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = req.ip || 'unknown';
  const key = `rate_limit:contact:${ip}`;

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, RATE_LIMIT_WINDOW_MS);
    }

    if (current > RATE_LIMIT_MAX) {
      res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
      });
      return;
    }

    next();
  } catch (err) {
    console.error('Rate limiter error:', err);
    // Fail open: if Redis is down, allow request
    next();
  }
}
