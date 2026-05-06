# M03: Bug Deep Dive — Not Awaiting Health Checks

## The Bug

The health check initiates async operations but does not `await` them. The function returns immediately with a "healthy" status before the checks complete.

### Buggy Code

```typescript
export async function checkHealth(): Promise<HealthStatus> {
  const checks = { database: 'ok', redis: 'ok' };

  // BUG: These promises are created but not awaited.
  // The function continues executing and returns before they settle.
  db.query('SELECT 1').catch(() => {
    checks.database = 'error';
  });

  redis.ping().catch(() => {
    checks.redis = 'error';
  });

  // This runs IMMEDIATELY, before db.query() or redis.ping() finish.
  return {
    status: 'healthy',  // Always 'healthy' because checks haven't failed yet
    checks,
  };
}
```

### The Execution Timeline

```
Time ──────────────────────────────────────────────────────▶

  checkHealth() called
       │
       ▼
  db.query('SELECT 1') initiated  ───────┐
       │                                  │
       ▼                                  │
  redis.ping() initiated  ───────────────┤
       │                                  │
       ▼                                  │
  checks object created {db:'ok', redis:'ok'}
       │                                  │
       ▼                                  │
  return { status: 'healthy', checks } ◄──┤ RESPONSE SENT
       │                                  │ (checks always ok)
       │                                  │
       │         ╔════════════════════════╝
       │         ║
       │         ║ (event loop continues, Node.js is free)
       │         ║
       │         ║  ~50ms later
       │         ║       │
       │         ║       ▼
       │         ║  db.query() rejects ◄── Database was actually down!
       │         ║       │
       │         ║       ▼
       │         ║  .catch() handler runs
       │         ║  checks.database = 'error'
       │         ║       │
       │         ║       ▼
       │         ║  TOO LATE! Response already sent.
       │         ║
       │         ╚═══════ Nobody is listening.
```

**The critical insight:** The `.catch()` callback runs later, on a future tick of the event loop. By then, `checkHealth()` has already returned and Express has already sent the HTTP response.

## Why This Is So Easy To Miss

The code looks correct:

```typescript
db.query('SELECT 1').catch(() => { checks.database = 'error'; });
```

It says "run this query, and if it fails, set the check to error." The mental model is sequential. But in JavaScript, `.catch()` does not block. It registers a callback for the future.

Compare with the fixed version:

```typescript
// FIXED: await pauses execution until the promise settles
try {
  await db.query('SELECT 1');
} catch {
  checks.database = 'error';
}
```

The `await` keyword is the difference between "schedule this for later" and "pause here until done."

## The Impact in Production

### Scenario: Database Outage

```
1. Database goes down at 14:00:00.

2. Load balancer sends health probe to Instance A at 14:00:01.
   Instance A's /health returns 200 (bug: not awaiting).
   LB keeps routing traffic to Instance A.

3. User requests arrive at Instance A at 14:00:02.
   They all fail with 500 errors because DB is down.

4. This continues for minutes because /health always says "healthy."

5. Engineers are paged. They check /health manually:
   curl http://instance-a/health  →  {"status":"healthy"}
   "Weird, the health check says it's fine..."

6. 30 minutes of debugging later, someone checks application logs
   and sees DB connection errors. The health check lied.
```

### The Testing Trap

In local development, the database is usually up. So the bug is invisible:

```bash
$ curl http://localhost:3000/health
{"status":"healthy","checks":{"database":"ok","redis":"ok"}}
```

Even with the bug, this returns correctly because the database is up and the checks happen to complete before you read the response. The bug only surfaces when:
1. The database is down (the `.catch()` should fire but doesn't in time).
2. You write a test that mocks the database to reject.

## The Fix

```typescript
export async function checkHealth(): Promise<HealthStatus> {
  const now = Date.now();

  if (cachedStatus && now - cachedAt < CACHE_TTL_MS) {
    return cachedStatus;
  }

  const checks = { database: 'ok', redis: 'ok' };

  // FIXED: Use try/await/catch to pause execution
  try {
    await db.query('SELECT 1');
  } catch {
    checks.database = 'error';
  }

  try {
    await redis.ping();
  } catch {
    checks.redis = 'error';
  }

  const status: HealthStatus = {
    status: checks.database === 'ok' && checks.redis === 'ok'
      ? 'healthy'
      : 'unhealthy',
    checks,
  };

  cachedStatus = status;
  cachedAt = now;

  return status;
}
```

### Execution Timeline After Fix

```
Time ──────────────────────────────────────────────────────▶

  checkHealth() called
       │
       ▼
  await db.query('SELECT 1')
       │
       ▼ (event loop yields, other requests can process)
       ╔═══════════════════════╗
       ║  ~50ms later          ║
       ║  db.query() rejects   ║
       ║       │               ║
       ║       ▼               ║
       ║  catch block runs     ║
       ║  checks.database = 'error'
       ╚═══════│═══════════════╝
               ▼
  await redis.ping()
       │
       ▼ (yields again)
       ╔═══════════════════════╗
       ║  ~10ms later          ║
       ║  redis.ping() rejects ║
       ║  checks.redis = 'error'
       ╚═══════│═══════════════╝
               ▼
  status = 'unhealthy'
       │
       ▼
  return { status: 'unhealthy', checks }
       │
       ▼
  Express sends 503
```

## Prevention Strategies

### 1. ESLint Rule: `require-await`

```json
{
  "rules": {
    "require-await": "error"
  }
}
```

This flags async functions that do not contain `await`. However, our buggy function *does* contain `await` in the cache check, so this would not catch it.

### 2. Always Test Failure Cases

The bug was caught by a test:

```typescript
it('returns 503 when database is down', async () => {
  vi.spyOn(db, 'query').mockRejectedValue(new Error('DB connection failed'));
  const res = await request(app).get('/health');
  expect(res.status).toBe(503);  // This FAILS with the bug
});
```

**Lesson:** Every async code path must have a test for the rejection case.

### 3. Use Promise.all for Parallel Checks (Carefully)

```typescript
// Still correct because we await the Promise.all
const [dbResult, redisResult] = await Promise.all([
  db.query('SELECT 1').then(() => true).catch(() => false),
  redis.ping().then(() => true).catch(() => false),
]);
```

`Promise.all` awaits all promises. The bug is not about parallel vs sequential; it is about awaiting vs fire-and-forget.
