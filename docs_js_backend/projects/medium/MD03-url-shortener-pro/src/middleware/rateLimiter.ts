import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '../redis.js';
import { config } from '../config.js';
import { ApiError } from '../types.js';

const shortenLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'ratelimit_shorten',
  points: config.rateLimitShortenPerMinute,
  duration: 60,
});

const redirectLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'ratelimit_redirect',
  points: config.rateLimitRedirectPerMinute,
  duration: 60,
});

export async function rateLimitShorten(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const key = req.ip || 'unknown';
    await shortenLimiter.consume(key);
    next();
  } catch {
    const error = new Error('Too many requests. Please try again later.') as ApiError;
    error.statusCode = 429;
    error.code = 'RATE_LIMIT_EXCEEDED';
    next(error);
  }
}

export async function rateLimitRedirect(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const key = req.ip || 'unknown';
    await redirectLimiter.consume(key);
    next();
  } catch {
    const error = new Error('Too many requests. Please try again later.') as ApiError;
    error.statusCode = 429;
    error.code = 'RATE_LIMIT_EXCEEDED';
    next(error);
  }
}
