# M15 Ping API — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You refactor v1 and add a helper function:

```js
// Still JS — no types
function measureLatency(target) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    http.get(target, (res) => {
      resolve(Date.now() - start);
    }).on('error', reject);
  });
}

app.get('/latency', async (req, res) => {
  const latency = await measureLatency(req.query.target);
  res.json({ latencyMs: latency });
});
```

**The bug:** `req.query.target` can be `string | string[] | undefined`. When a user sends `?target=host1&target=host2`, `target` is an array. `http.get(['host1', 'host2'])` throws a cryptic runtime error.

Another bug: `measureLatency` returns `number`, but somewhere else you treat it as `{ latencyMs: number }`. No compiler tells you.

## The Fix: Add TypeScript

```ts
// latency.ts
import { lookup } from 'node:dns/promises';
import net from 'node:net';

export async function measureLatency(
  target: string
): Promise<{ host: string; ip: string; latencyMs: number }> {
  // Strip port if present
  const host = target.split(':')[0];

  // Resolve DNS
  const addresses = await lookup(host);
  const ip = addresses.address;

  // Measure TCP connection latency
  const port = Number(target.split(':')[1]) || 80;
  const tcpStart = performance.now();

  await new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    socket.connect(port, ip, () => {
      socket.destroy();
      resolve();
    });
    socket.on('error', reject);
  });

  return {
    host,
    ip,
    latencyMs: Math.round(performance.now() - tcpStart),
  };
}
```

```ts
// app.ts
import express, { Request, Response } from 'express';
import { measureLatency } from './latency.js';

export const app = express();

app.get('/latency', async (req: Request, res: Response) => {
  const target = req.query.target as string;

  if (!target || typeof target !== 'string') {
    res.status(400).json({ error: 'Missing target query parameter' });
    return;
  }

  const result = await measureLatency(target);
  res.json(result);
});
```

**What TS catches immediately:**
- `req.query.target` is `ParsedQs | string | string[]` — you must narrow it
- `measureLatency` now has a strict return type — no more guessing
- `lookup()` returns `{ address: string; family: number }` — you can't accidentally destructure the wrong property

## The Pain That Remains

TypeScript won't stop an attacker from sending `?target=localhost`. Types validate shape, not intent. We need validation.

## What v3 Fixes

Input validation. Stop users (and attackers) from sending garbage.
