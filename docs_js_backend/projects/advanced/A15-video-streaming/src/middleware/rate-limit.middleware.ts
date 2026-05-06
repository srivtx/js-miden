import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

const requestCounts = new Map<string, number>();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100;

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || 'unknown';
  const now = Date.now();

  // Simple in-memory rate limiting (production: use Redis)
  const count = requestCounts.get(key) || 0;
  if (count >= MAX_REQUESTS) {
    logger.warn({ ip: key }, 'Rate limit exceeded');
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
    return;
  }

  requestCounts.set(key, count + 1);
  setTimeout(() => {
    requestCounts.set(key, (requestCounts.get(key) || 1) - 1);
  }, WINDOW_MS);

  next();
}
