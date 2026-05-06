# Step-by-Step Build Guide

## Step 1: Define Event Types

Create the core event schema and database model.

```typescript
const eventSchema = z.object({
  eventType: z.string().min(1).max(100),
  payload: z.record(z.unknown()).default({}),
  source: z.string().min(1).max(200).default('api'),
  timestamp: z.string().datetime().optional(),
});
```

### Common Mistakes
- **Mistake**: Using `any` for payload.
- **Why it breaks**: No validation means arbitrary data, leading to injection or storage bloat.
- **How to avoid**: Use `z.record(z.unknown())` with max depth validation.

## Step 2: Build the Ingestion Endpoint

```typescript
router.post('/', async (req, res) => {
  const rawEvents = Array.isArray(req.body) ? req.body : [req.body];
  const validated = rawEvents.map((raw) => eventSchema.parse(raw));
  
  // Persist to PostgreSQL
  await prisma.event.createMany({ data: events });
  
  // Update Redis counters (ATOMIC)
  for (const event of events) {
    await redis.incr(`counter:${event.eventType}:${windowKey}`);
    await redis.expire(key, config.metricsRetentionHours * 3600);
  }
  
  res.status(201).json({ ingested: events.length });
});
```

### Common Mistakes
- **Mistake**: Non-atomic read-modify-write for counters.
- **Why it breaks**: Concurrent events lose updates.
- **How to avoid**: Use `redis.incr()`, `redis.hincrby()`, or Lua scripts.

## Step 3: Implement Windowing

```typescript
export class AggregationEngine {
  getWindowKey(timestamp: Date): string {
    const windowSizeMs = 60_000; // 1 minute
    const windowStart = Math.floor(timestamp.getTime() / windowSizeMs) * windowSizeMs;
    return new Date(windowStart).toISOString();
  }
}
```

### Common Mistakes
- **Mistake**: Window size too small (1ms).
- **Why it breaks**: Infinite key space. Redis chokes.
- **How to avoid**: Use 1-minute or 1-hour windows for most metrics.

## Step 4: Add Sliding Window Calculation

```typescript
calculateSlidingWindow(events, windowSizeMs, stepSizeMs) {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const results = [];
  for (let start = sorted[0].timestamp; start <= sorted[sorted.length - 1].timestamp; start += stepSizeMs) {
    const windowEvents = sorted.filter(e => e.timestamp >= start && e.timestamp < start + windowSizeMs);
    if (windowEvents.length > 0) {
      const sum = windowEvents.reduce((acc, e) => acc + e.value, 0);
      results.push({ windowStart: new Date(start), count: windowEvents.length, sum, avg: sum / windowEvents.length });
    }
  }
  return results;
}
```

### Common Mistakes
- **Mistake**: Not sorting events before windowing.
- **Why it breaks**: Out-of-order events produce wrong windows.
- **How to avoid**: Always sort by timestamp.

## Step 5: Build the Dashboard API

```typescript
router.get('/', async (req, res) => {
  const eventTypes = await redis.smembers('event:types');
  const metrics = await Promise.all(
    eventTypes.map(async (type) => {
      const count = await redis.get(`counter:${type}:${windowKey}`);
      return { eventType: type, count: parseInt(count ?? '0', 10) };
    })
  );
  res.json({ metrics, window: windowKey });
});
```

### Common Mistakes
- **Mistake**: Not setting TTL on Redis keys.
- **Why it breaks**: Unbounded memory growth. Redis OOM.
- **How to avoid**: `redis.expire(key, retentionSeconds)` on every write.

## Step 6: Schedule Window Cleanup

```typescript
setInterval(() => {
  const cutoff = new Date(Date.now() - config.metricsRetentionHours * 3600000);
  // Scan and delete keys older than cutoff
}, 60_000);
```

### Common Mistakes
- **Mistake**: Never cleaning up old windows.
- **Why it breaks**: Linear memory growth. Container killed by Kubernetes OOMKiller.
- **How to avoid**: Background job + Redis TTL.
