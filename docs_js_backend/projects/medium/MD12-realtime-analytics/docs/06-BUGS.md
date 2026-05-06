# The Bugs

## Bug 1: Race Condition in Aggregation

### How to Introduce It
Use application-side read-modify-write instead of atomic Redis operations:

```typescript
async function processEventWithRaceCondition(event) {
  const counterKey = `counter:${event.eventType}:${event.windowKey}`;
  
  // BUG: Non-atomic read-modify-write
  const currentCount = await redis.get(counterKey); // Both read "5"
  const newCount = (parseInt(currentCount ?? '0', 10)) + 1; // Both compute "6"
  await redis.set(counterKey, newCount.toString()); // Both write "6"
  await redis.expire(counterKey, config.metricsRetentionHours * 3600);
}
```

### Why It Exists
The developer assumed single-threaded Node.js meant no concurrency. But Node.js handles multiple HTTP requests concurrently. Two requests can interleave between `GET` and `SET`.

### Symptoms You'll See
- Aggregated counts are lower than actual event counts.
- The discrepancy grows with traffic. At 100 req/s, ~5-10% of updates are lost.
- Financial metrics (revenue, order counts) don't match the source of truth.

### How to Reproduce
```typescript
// Simulate 10 concurrent requests
const promises = Array.from({ length: 10 }, () => processEventWithRaceCondition(event));
await Promise.all(promises);
const finalCount = await redis.get(counterKey);
console.log(finalCount); // Often < 10
```

### The Fix
```typescript
async function processEventAtomically(event) {
  const counterKey = `counter:${event.eventType}:${event.windowKey}`;
  await redis.incr(counterKey); // Atomic
  await redis.expire(counterKey, config.metricsRetentionHours * 3600);
  
  if (typeof event.payload.value === 'number') {
    const sumKey = `sum:${event.eventType}:${event.windowKey}`;
    await redis.incrbyfloat(sumKey, event.payload.value); // Atomic
  }
}
```

### Why the Fix Works
`INCR`, `INCRBY`, `INCRBYFLOAT`, and `HINCRBY` are single-command atomic operations on the Redis server. No interleaving is possible.

### Real-World Impact
In 2018, a food delivery platform used application-side counters for "orders per minute" during a Black Friday sale. The dashboard showed 12,000 orders, but the payment gateway recorded 14,500. The discrepancy (2,500 lost updates) caused inventory misallocation and delayed deliveries. Root cause: `GET` → `SET` race condition under concurrent checkout requests.

---

## Bug 2: No Window Cleanup

### How to Introduce It
Never call `cleanupOldWindows()`. Create new window keys forever without deletion.

```typescript
export class AggregationEngine {
  getWindowKey(timestamp: Date): string {
    const windowStart = Math.floor(timestamp.getTime() / this.windowSizeMs) * this.windowSizeMs;
    return new Date(windowStart).toISOString();
  }
  // No cleanup method called anywhere
}
```

### Why It Exists
The developer planned to add a cron job later but forgot. "We'll add retention in v2." The system ran for 3 months before Redis memory usage became critical.

### Symptoms You'll See
- Redis memory usage grows linearly (~50MB/day for moderate traffic).
- `INFO memory` shows `used_memory_human` increasing monotonically.
- After 2-4 weeks, the container is killed by Kubernetes OOMKiller.
- Dashboard queries slow down because Redis scans more keys.

### How to Reproduce
```bash
# Generate 1 event per second for 1 hour
for i in $(seq 1 3600); do
  curl -X POST http://localhost:3000/events \
    -d '{"eventType":"test","payload":{}}'
done
# Check Redis key count
redis-cli dbsize # Grows by ~60 keys (1 per minute)
```

### The Fix
```typescript
// Set TTL on every write
await redis.incr(counterKey);
await redis.expire(counterKey, config.metricsRetentionHours * 3600);

// Plus a background cleanup job
setInterval(async () => {
  const cutoff = new Date(Date.now() - config.metricsRetentionHours * 3600000);
  const keys = await redis.keys('counter:*');
  for (const key of keys) {
    const windowTime = new Date(key.split(':').pop()!);
    if (windowTime < cutoff) {
      await redis.del(key);
    }
  }
}, 60_000);
```

### Why the Fix Works
TTL ensures Redis auto-deletes expired keys. The background job is a safety net for keys that might have missed TTL. Memory usage plateaus instead of growing forever.

### Real-World Impact
In 2020, a SaaS analytics startup never implemented TTL on their time-series keys. After 90 days, their Redis instance grew to 128GB. The hosting provider charged $2,000/month for the oversized instance. A 3-hour outage occurred when Redis hit the memory limit and began evicting active keys. The fix (adding `EXPIRE`) took 10 minutes to deploy.
