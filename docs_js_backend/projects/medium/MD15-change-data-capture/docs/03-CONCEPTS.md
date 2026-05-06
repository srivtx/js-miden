# Concepts Explained

## Concept: Write-Ahead Log (WAL)

### What Is It?
PostgreSQL writes every change to a sequential log before applying it to data files. This ensures durability: even if the server crashes mid-write, the log can replay the change.

### Why Do We Use It?
CDC reads the WAL to see changes as they happen, without querying the actual tables.

### How Does It Work?
```
Client sends INSERT
        │
        ▼
PostgreSQL writes to WAL (LSN = 100)
        │
        ▼
PostgreSQL applies to table
        │
        ▼
CDC reader sees LSN 100 in WAL
        │
        ▼
Publishes event to consumers
```

### Common Misconceptions
- **Wrong way**: Reading the table with `SELECT * FROM users WHERE updated_at > ?`. Misses rapid changes and deletes.
- **Right way**: Reading the WAL or logical replication slot.

## Concept: LSN (Log Sequence Number)

### What Is It?
A monotonically increasing identifier for each WAL record. Like a "version number" for the entire database.

### Why Is It Important?
Consumers use LSN to resume after a crash. "I processed up to LSN 1000, so start from 1001."

### Code Example
```typescript
const lastLsn = await getConsumerOffset('cache');
const events = await readChangesSince(lastLsn);
for (const event of events) {
  await handleCacheUpdate(event);
  await setConsumerOffset('cache', event.lsn);
}
```

## Concept: Exactly-Once Delivery

### What Is It?
A guarantee that every event is processed exactly one time, even across failures.

### Why Is It Hard?
The "check then act" pattern is inherently racy:
```typescript
if (!processed(event.id)) {  // check
  process(event);            // act
  markProcessed(event.id);   // another check+act!
}
```

### The Real Solution
Idempotent consumers. Instead of "process once", design operations so that processing twice is harmless:
```typescript
// Idempotent cache update
await redis.set(`user:${event.after.id}`, JSON.stringify(event.after));
// Running this twice just overwrites with the same value.
```
