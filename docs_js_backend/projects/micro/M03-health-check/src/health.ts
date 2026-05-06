import { db } from './db.js';
import { redis } from './redis.js';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  checks: {
    database: string;
    redis: string;
  };
}

let cachedStatus: HealthStatus | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;

export function clearHealthCache(): void {
  cachedStatus = null;
  cachedAt = 0;
}

export async function checkHealth(): Promise<HealthStatus> {
  const now = Date.now();

  if (cachedStatus && now - cachedAt < CACHE_TTL_MS) {
    return cachedStatus;
  }

  const checks = {
    database: 'ok',
    redis: 'ok',
  };

  // INTENTIONAL BUG: The async health checks are initiated but never awaited.
  // Because the function returns immediately, the status is always "healthy"
  // and the endpoint always returns 200, even when DB or Redis are down.
  db.query('SELECT 1').catch(() => {
    checks.database = 'error';
  });

  redis.ping().catch(() => {
    checks.redis = 'error';
  });

  const status: HealthStatus = {
    status: 'healthy',
    checks,
  };

  cachedStatus = status;
  cachedAt = now;

  return status;
}
