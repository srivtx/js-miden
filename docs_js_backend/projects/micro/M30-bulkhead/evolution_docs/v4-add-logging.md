# M30 Bulkhead — v4 Add Logging

## The Bug: Production Visibility Crisis

You deploy v3. Support ticket arrives: *"Users are getting 503 errors."*

You SSH into the box. You have zero visibility into:

- Which pool is full?
- How many requests are active vs max?
- Is it background jobs or critical requests causing the saturation?
- When did the pool last have capacity?

```ts
// Without logging — silent rejection
app.get('/critical', async (req, res) => {
  try {
    const result = await executeWithPool('critical', async () => { ... });
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: err.message }); // Why? No idea.
  }
});
```

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

export async function executeWithPool<T>(
  poolName: string,
  fn: () => Promise<T>
): Promise<T> {
  const pool = pools[poolName];
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();

  logger.debug({ requestId, pool: poolName, active: pool.getActive(), max: pool.getMax() }, 'Pool check');

  if (!pool.hasCapacity()) {
    logger.warn({ requestId, pool: poolName, active: pool.getActive(), max: pool.getMax() }, 'Pool full — rejecting request');
    throw new Error(`Pool ${poolName} is full`);
  }

  pool.acquire();
  logger.info({ requestId, pool: poolName, active: pool.getActive() }, 'Slot acquired');

  try {
    const result = await fn();
    logger.info({ requestId, pool: poolName }, 'Request completed');
    return result;
  } finally {
    pool.release();
    logger.debug({ requestId, pool: poolName, active: pool.getActive() }, 'Slot released');
  }
}
```

Now your logs tell the story:
```json
{"level":"warn","requestId":"abc","pool":"background","active":5,"max":5,"msg":"Pool full — rejecting request"}
{"level":"info","requestId":"def","pool":"critical","active":3,"msg":"Slot acquired"}
```

## The Pain That Remains

You add a new pool for analytics. In the process, you change the critical pool max from 10 to 3 because you copy-pasted the background pool config. You deploy. Critical requests start failing under normal load. No test caught it.

## What v5 Fixes

Testing. Silent breakage when adding features is unacceptable.
