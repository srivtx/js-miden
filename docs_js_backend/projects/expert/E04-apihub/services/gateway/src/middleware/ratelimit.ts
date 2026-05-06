import { Router, Request, Response } from 'express';

const router = Router();

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  apiKeyId: string,
  tierLimitPerSecond: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = Date.now();
  const windowMs = 1000;
  const key = `${apiKeyId}:${Math.floor(now / windowMs)}`;
  
  let entry = rateLimitStore.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
  }
  
  entry.count++;
  
  const allowed = entry.count <= tierLimitPerSecond;
  const remaining = Math.max(0, tierLimitPerSecond - entry.count);
  
  return { allowed, remaining, resetAt: new Date(entry.resetAt) };
}

export async function getRateLimitStatus(
  apiKeyId: string,
  tierLimitPerSecond: number
): Promise<{ remaining: number; resetAt: Date; limit: number }> {
  const now = Date.now();
  const windowMs = 1000;
  const key = `${apiKeyId}:${Math.floor(now / windowMs)}`;
  
  const entry = rateLimitStore.get(key);
  const count = entry ? entry.count : 0;
  const resetAt = entry ? entry.resetAt : now + windowMs;
  
  return {
    remaining: Math.max(0, tierLimitPerSecond - count),
    resetAt: new Date(resetAt),
    limit: tierLimitPerSecond
  };
}

export default router;
