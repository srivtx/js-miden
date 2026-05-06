import { config } from '../config.js';
import type { Request, Response, NextFunction } from 'express';

const requestCounts = new Map<string, { count: number; resetAt: number }>();

// BUG: Global rate limit, not per-tenant
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60000;
  const limit = config.defaultRateLimit;

  const record = requestCounts.get(key);
  if (!record || now > record.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  if (record.count >= limit) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  record.count++;
  next();
}
