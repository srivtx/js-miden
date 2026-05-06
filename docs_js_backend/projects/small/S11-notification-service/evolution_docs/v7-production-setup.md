# v7 — Production Setup

Your notification service works. It has persistence, atomic counters, aggregation, SSE streaming, validation, logs, and tests. But production notifications are a different beast.

## Pain #1: SQLite Can't Handle Fan-Out

A viral post gets 10,000 likes in 1 minute. You're writing 10,000 notification rows and doing 10,000 SSE broadcasts. SQLite serializes writes. Your queue backs up. Users see delays.

**Fix:** PostgreSQL + connection pooling + Redis for pub/sub.

```ts
import { createClient } from 'redis';
const redis = createClient({ url: process.env.REDIS_URL });

// Publish unread count update
redis.publish(`user:${userId}:unread`, JSON.stringify({ count: newCount }));

// SSE subscriber listens to Redis
redis.subscribe(`user:${userId}:unread`, (message) => {
  broadcastToClients(userId, JSON.parse(message));
});
```

Now you can scale SSE servers horizontally. All instances receive the Redis pub/sub message.

## Pain #2: Missing Aggregation

Every like still creates a row. Your database is 90% "like" notifications.

**Fix:** Aggressive aggregation.

```ts
// On like event
const existing = db.prepare(
  'SELECT id, count FROM notifications WHERE user_id = ? AND type = ? AND reference_id = ?'
).get(userId, 'like', postId);

if (existing) {
  db.prepare('UPDATE notifications SET count = count + 1, updated_at = ? WHERE id = ?')
    .run(Date.now(), existing.id);
} else {
  db.prepare('INSERT INTO notifications (...) VALUES (...)').run(...);
}
```

## Pain #3: No Deduplication

A buggy client sends the same notification 50 times. The user gets 50 identical messages.

**Fix:** Deduplication key.

```ts
const dedupKey = `${userId}:${type}:${reference_id}:${Math.floor(Date.now() / 60000)}`;
// Only create if no notification with this key in the last minute
```

## Pain #4: SSE Connection Leaks

Under load, connections drop but cleanup is missed. Memory grows.

**Fix:** Heartbeat pings and aggressive timeouts.

```ts
const heartbeat = setInterval(() => {
  res.write(':heartbeat\n\n');
}, 30000);

req.on('close', () => {
  clearInterval(heartbeat);
  clearInterval(updateInterval);
});
```

## Pain #5: Environment Config

You hardcoded the SSE interval to 2 seconds and the max clients to unlimited.

**Fix:** Env vars.

```ts
const SSE_INTERVAL = parseInt(process.env.SSE_INTERVAL || '2000');
const MAX_CLIENTS_PER_USER = parseInt(process.env.MAX_CLIENTS_PER_USER || '5');
```

## Final Checklist

- [ ] PostgreSQL with connection pooling
- [ ] Redis pub/sub for SSE fan-out
- [ ] Atomic counter increments/decrements
- [ ] Notification aggregation
- [ ] Deduplication
- [ ] SSE heartbeat and connection limits
- [ ] Rate limiting on notification creation
- [ ] Environment-based config
- [ ] Graceful shutdown
- [ ] Health check endpoint

This is a production notification service. It started as an in-memory array. Now it handles viral events, real-time delivery, and scalable fan-out.
