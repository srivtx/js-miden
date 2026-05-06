# Concepts Explained

## Concept: Write-Ahead Log (WAL)

### WHAT Is It?
PostgreSQL writes every change to a sequential log before applying it to data files. This ensures durability: even if the server crashes mid-write, the log can replay the change.

### WHY Do We Use It?
CDC reads the WAL to see changes as they happen, without querying the actual tables.

### HOW Does It Work?
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

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Reading the table with `SELECT * FROM users WHERE updated_at > ?`. Misses rapid changes and deletes. | Reading the WAL or logical replication slot. |
| Using database triggers. Slows writes, phantom events on rollback. | Using post-commit WAL reading. |

---

## Concept: LSN (Log Sequence Number)

### WHAT Is It?
A monotonically increasing identifier for each WAL record. Like a "version number" for the entire database.

### WHY Is It Important?
Consumers use LSN to resume after a crash. "I processed up to LSN 1000, so start from 1001."

### HOW Does It Work?
```typescript
const lastLsn = await getConsumerOffset('cache');
const events = await readChangesSince(lastLsn);
for (const event of events) {
  await handleCacheUpdate(event);
  await setConsumerOffset('cache', event.lsn);
}
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Using timestamp as offset. Clock skew causes duplicates or skips. | Using database-native LSN. Monotonic, no gaps. |
| In-memory offsets. Lost on restart. | Persistent offsets in the same database or a durable store. |

---

## Concept: Exactly-Once Delivery

### WHAT Is It?
A guarantee that every event is processed exactly one time, even across failures.

### WHY Is It Hard?
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

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Trying to build exactly-once with distributed transactions. | At-least-once + idempotent operations. |
| Sending emails without deduplication. | Storing `lastProcessedLsn` and deduplicating by LSN. |

---

## Concept: Event Ordering

### WHAT Is It?
Ensuring consumers process events in the same order they were committed to the database.

### WHY Is It Important?
An UPDATE for a row must not be processed before its INSERT. Otherwise, the cache contains data for a non-existent row.

### HOW Does It Work?
```typescript
// WRONG: Out-of-order
await Promise.all(events.map(e => handler(e)));

// RIGHT: Sequential in LSN order
for (const event of events) {
  await handler(event);
}
await setConsumerOffset(consumerId, events[events.length - 1].lsn);
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Processing events with `Promise.all()`. | Processing in a single `for...of` loop. |
| Updating offset per-event. | Updating offset only after the entire batch succeeds. |

---

## Concept: Idempotent Consumers

### WHAT Is It?
A consumer that produces the same result whether an event is processed once or multiple times.

### WHY Do We Use It?
At-least-once delivery means duplicates are inevitable. Idempotency makes duplicates harmless.

### HOW Does It Work?
```typescript
// Cache consumer: idempotent
if (event.operation === 'INSERT' || event.operation === 'UPDATE') {
  cache.set(`user:${event.after.id}`, event.after);
} else if (event.operation === 'DELETE') {
  cache.delete(`user:${event.before.id}`);
}

// Notification consumer: NOT idempotent without deduplication
// Sending an email twice is bad. Need to track processed LSNs.
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Sending emails without deduplication. | Tracking `lastProcessedLsn` per consumer. |
| Cache `increment` operations. | Cache `set` operations (overwrite is safe). |
