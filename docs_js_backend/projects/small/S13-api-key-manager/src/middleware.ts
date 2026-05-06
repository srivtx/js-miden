import { Request, Response, NextFunction } from 'express';
import db from './db.js';

interface AuthenticatedRequest extends Request {
  apiKey?: any;
}

const rateLimits = new Map<string, { count: number; windowStart: number }>();

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'] as string;
  if (!key) return res.status(401).json({ error: 'Missing API key' });

  // BUG: Plaintext lookup means if DB is breached, all keys are exposed.
  // Also relies on SQLite string comparison which is not timing-safe.
  const row = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND revoked = 0').get(key) as
    | { id: number; key_hash: string; expires_at: number | null; rate_limit: number; scopes: string | null }
    | undefined;

  if (!row) return res.status(401).json({ error: 'Invalid API key' });

  // BUG: No expiration check - keys valid forever even if expires_at is set
  // if (row.expires_at && Date.now() > row.expires_at) {
  //   return res.status(401).json({ error: 'API key expired' });
  // }

  // Rate limiting (sliding window per minute)
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000;
  const limitKey = `${row.id}:${windowStart}`;
  const current = rateLimits.get(limitKey) || { count: 0, windowStart };
  if (current.count >= row.rate_limit) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  current.count++;
  rateLimits.set(limitKey, current);

  req.apiKey = row;
  next();
}
