# v7 — Production Setup

Your polling API works. It has deduplication, atomic increments, SSE streaming, validation, logs, and tests. But production is a war zone.

## Pain #1: SSE Connection Leaks

Under load, browsers disconnect abruptly. Your `req.on('close')` handler misses some. You leak `setInterval` callbacks. Memory grows. The server crashes.

**Fix:** Defensive cleanup.

```ts
const interval = setInterval(sendResults, 2000);
const cleanup = () => {
  clearInterval(interval);
  res.end();
};
req.on('close', cleanup);
req.on('end', cleanup);
req.on('error', cleanup);
```

Also, cap the number of concurrent SSE connections per poll.

## Pain #2: No Rate Limiting

Someone scripts 10,000 votes per second. Your database locks up. Legitimate users can't vote.

**Fix:** Rate limiting per IP.

```ts
import rateLimit from 'express-rate-limit';

const voteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many votes, try again later' },
});

app.post('/polls/:id/vote', voteLimiter, handler);
```

## Pain #3: SQLite Won't Scale

SQLite handles one write at a time. Under concurrent load, writes queue up. Response times spike.

**Fix:** PostgreSQL with connection pooling.

```ts
import pg from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```

## Pain #4: Environment Config

You hardcoded the SSE interval to 2000ms and the max redirects to 10. In production, you might want 500ms intervals for faster updates.

**Fix:** Env vars.

```ts
const SSE_INTERVAL = parseInt(process.env.SSE_INTERVAL || '2000');
const MAX_SSE_CLIENTS = parseInt(process.env.MAX_SSE_CLIENTS || '1000');
```

## Pain #5: Process Crashes

An unhandled error in an SSE stream kills the entire server.

**Fix:** Error boundaries and graceful shutdown.

```ts
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
```

## Final Checklist

- [ ] SSE cleanup on all disconnect paths
- [ ] Rate limiting on votes
- [ ] PostgreSQL for concurrent writes
- [ ] Connection pooling
- [ ] Environment-based config
- [ ] Graceful shutdown
- [ ] Health check endpoint
- [ ] Request timeouts

This is a production polling API. It started as an in-memory object. Now it handles real votes, real concurrency, and real-time streams.
