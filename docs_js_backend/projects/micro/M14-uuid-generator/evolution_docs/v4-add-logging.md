# v4-add-logging.md — UUID Generator

## The Pain

In production, UUID generation was a black box:

```typescript
app.post('/generate', (req, res) => {
  const uuid = generateUUID();
  res.json({ uuid });
});
```

1. How many UUIDs generated per second? Unknown.
2. Any validation failures on `/validate/:uuid`? Unknown.
3. A bug where UUIDs collide? We'd only find out in production data.
4. Performance degradation? No timing data.

## The Fix: Add Generation & Validation Logging

```typescript
// logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'uuid-generator' },
});
```

```typescript
// routes.ts
import { logger } from './logger.js';

app.post('/generate', (req, res) => {
  const start = Date.now();
  const uuid = generateUUID();
  logger.info({ duration: Date.now() - start }, 'UUID generated');
  res.json({ uuid });
});

app.get('/validate/:uuid', (req, res) => {
  const { uuid } = req.params;
  const valid = isValidUUID(uuid);
  logger.info({ uuid, valid }, 'UUID validated');
  res.json({ uuid, valid });
});
```

Now logs look like:
```json
{"level":30,"time":1715000000000,"service":"uuid-generator","duration":0,"msg":"UUID generated"}
{"level":30,"time":1715000000100,"service":"uuid-generator","uuid":"550e8400-e29b-41d4-a716-446655440000","valid":false,"msg":"UUID validated"}
```

## But Logging Doesn't Fix Predictable UUIDs

If `generateUUID()` uses `Math.random()`, the logs will show valid-looking UUIDs that an attacker can predict. Logging reveals volume and performance, but not cryptographic quality.

> **Lesson:** Logging tracks operational health. But security properties (unpredictability) are verified by algorithm choice, not telemetry.
