# v4-add-logging

## Goal
Track every redirect, shorten, and analytics request.

## Changes
1. `pino` logger with request-level child.
2. Log `shortCode`, `referrer`, `ip`, and `userAgent` on redirect.
3. Log DB query durations.

## Code

```ts
// src/services/shortener.ts
import { logger } from '../logger.js';

export async function recordClick(shortCode: string, referrer?: string, ip?: string) {
  const start = performance.now();
  await pool.query('INSERT INTO clicks (short_code, referrer, ip) VALUES ($1, $2, $3)', [shortCode, referrer || null, ip || null]);
  logger.info({ shortCode, referrer, ip, durationMs: performance.now() - start }, 'click_recorded');
}
```

```ts
// src/controller.ts
export async function redirectShortUrl(req: Request, res: Response) {
  const { shortCode } = req.params;
  const entry = await getUrlByShortCode(shortCode);
  if (!entry) {
    logger.warn({ shortCode, ip: req.ip }, 'redirect_not_found');
    return res.status(404).json({ error: 'Not found' });
  }
  // ...
}
```

## Decisions
- Async click logging — do not block redirect with `await`. Use `logger.info` or offload to a queue if DB write latency spikes.
- IP hashing for GDPR — store `sha256(ip + daily_salt)` instead of raw IP in production.

## Risks
- High-traffic short links can DDoS the click table. Use batch inserts or Redis counter + periodic flush.
