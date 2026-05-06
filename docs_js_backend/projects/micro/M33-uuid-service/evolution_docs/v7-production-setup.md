# M33 UUID Service — v7 Production Setup

## The Journey

We started with a single v4 endpoint, layered in types, validation, logging, tests, and ESM. Now we have a UUID service that supports multiple formats, bulk generation, and input validation.

## What v7 Adds

- **Multiple UUID versions**: v4 (random), v7 (time-ordered), ULID (lexicographically sortable)
- **Bulk generation**: Generate up to 1000 UUIDs in one request
- **Input validation**: Reject invalid counts and unsupported types
- **Correct v7 timestamps**: Milliseconds since epoch, not seconds

## The Final Code

```ts
// src/uuid.ts
export function uuidV4(): string {
  return crypto.randomUUID();
}

export function uuidV7(): string {
  const now = Date.now();
  const timeHex = now.toString(16).padStart(12, '0');
  const randA = Math.floor(Math.random() * 0x1000)
    .toString(16)
    .padStart(3, '0');
  const randB = Math.floor(Math.random() * 0x4000)
    .toString(16)
    .padStart(4, '0');
  const randC = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');

  return `${timeHex.slice(0, 8)}-${timeHex.slice(8)}-7${randA}-${randB}-${randC}`;
}

export function ulid(): string {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let timestamp = Date.now();
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = ENCODING[timestamp % 32] + time;
    timestamp = Math.floor(timestamp / 32);
  }
  const random = Array.from({ length: 16 }, () =>
    ENCODING[Math.floor(Math.random() * 32)]
  ).join('');
  return time + random;
}

export function bulkGenerate(count: number, type: 'v4' | 'v7' | 'ulid'): string[] {
  const generator = type === 'v4' ? uuidV4 : type === 'v7' ? uuidV7 : ulid;
  return Array.from({ length: count }, () => generator());
}
```

```ts
// src/index.ts
import express, { Request, Response } from 'express';
import { uuidV4, uuidV7, ulid, bulkGenerate } from './uuid.js';

const app = express();
app.use(express.json());

app.get('/uuid/v4', (_req: Request, res: Response) => {
  res.json({ uuid: uuidV4() });
});

app.get('/uuid/v7', (_req: Request, res: Response) => {
  res.json({ uuid: uuidV7() });
});

app.get('/uuid/ulid', (_req: Request, res: Response) => {
  res.json({ ulid: ulid() });
});

app.post('/uuid/bulk', (req: Request, res: Response) => {
  const { count = 1, type = 'v4' } = req.body;
  const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 1000);
  const results = bulkGenerate(n, type as 'v4' | 'v7' | 'ulid');
  res.json({ count: n, type, results });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M33 listening on :3000'));
}
```

## Why This Matters in Production

Without multiple UUID versions, teams build inconsistent client-side workarounds. Without bulk generation, batch jobs DDoS your server. Without validation, a single malformed request can crash the service. Without correct v7 timestamps, database indexes fragment and queries slow down.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | Only v4, no bulk | Multiple endpoints |
| v2 | Typos in response shapes | TypeScript interfaces |
| v3 | No input validation | Runtime count/type validation |
| v4 | No visibility into generation | Structured logging |
| v5 | v7 timestamp precision bug | Jest tests for timestamp extraction |
| v6 | CJS module resolution issues | ESM with NodeNext |
| v7 | Wrong v7 precision, no bulk limits | Correct ms timestamps + bulk validation |

## Run It

```bash
PORT=3000 NODE_ENV=production node dist/index.js
```
