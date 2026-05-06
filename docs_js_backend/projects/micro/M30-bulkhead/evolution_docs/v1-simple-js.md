# M30 Bulkhead — v1 Simple JS

## The Naive Beginning

You need to protect your API from overload. The simplest thing: one shared pool for everything.

```js
// server.js
const express = require('express');
const app = express();

const sharedPool = {
  max: 3,
  active: 0,
  acquire() {
    if (this.active >= this.max) throw new Error('Pool is full');
    this.active++;
  },
  release() {
    if (this.active > 0) this.active--;
  }
};

async function executeWithPool(fn) {
  sharedPool.acquire();
  try {
    return await fn();
  } finally {
    sharedPool.release();
  }
}

app.get('/critical', async (req, res) => {
  try {
    const result = await executeWithPool(async () => {
      await new Promise(r => setTimeout(r, 100));
      return { type: 'critical', status: 'ok' };
    });
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.get('/background', async (req, res) => {
  try {
    const result = await executeWithPool(async () => {
      await new Promise(r => setTimeout(r, 100));
      return { type: 'background', status: 'ok' };
    });
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

app.listen(3000);
```

**"This works. It limits concurrency. Ship it."**

## The Pain in Production

### 1. Background Jobs Starve Critical Requests

```bash
# Flood background pool (6 concurrent)
for i in {1..6}; do curl -s http://localhost:3000/background & done; wait
# → 3 succeed, 3 return 503

# Critical request during the flood
curl http://localhost:3000/critical
# → 503 "Pool is full"
```

Both `/critical` and `/background` share the same pool. When background jobs fill it, critical user-facing requests are rejected. Your users can't log in because a batch job is running.

### 2. No Workload Prioritization

Analytics jobs, email sends, and user logins all compete for the same 3 slots. There's no way to protect the critical path.

### 3. No Queue Limits

Rejected requests fail immediately. There's no queue to buffer bursts. A temporary spike drops valid requests.

### 4. No Adaptive Sizing

The pool size is hardcoded to 3. During Black Friday, you need 100 slots. At 3am, you need 5. The pool never adapts.

## What We Have

- **Single shared pool** — background starves critical
- **No isolation** — one workload type can kill all others
- **No prioritization** — all requests are equal
- **Fixed capacity** — doesn't scale with load

## What v2 Fixes

TypeScript. Before we solve the architecture, let's stop pool state corruption from type errors.
