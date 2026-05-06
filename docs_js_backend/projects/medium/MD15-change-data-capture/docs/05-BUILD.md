# Step-by-Step Build Guide

## Step 1: Create the CDC Events Table

```sql
CREATE TABLE cdc_events (
  lsn BIGSERIAL PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  operation VARCHAR(10) NOT NULL,
  before_json JSONB,
  after_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Common Mistakes
- **Mistake**: Using `SERIAL` instead of `BIGSERIAL`.
- **Why it breaks**: At 1K events/second, `SERIAL` overflows in ~25 days.
- **How to avoid**: Always use `BIGSERIAL` (64-bit) for event logs.

## Step 2: Publish Changes from Application Code

```typescript
const event: ChangeEvent = {
  lsn: await getNextLsn(),
  table: 'users',
  operation: 'INSERT',
  before: null,
  after: user,
  timestamp: Date.now(),
};
await publishChange(event);
```

### Common Mistakes
- **Mistake**: Publishing before the database transaction commits.
- **Why it breaks**: If the transaction rolls back, the event is a "phantom" — consumers act on data that was never committed.
- **How to avoid**: Publish inside the transaction, or use WAL reading (post-commit).

## Step 3: Implement the Consumer Dispatcher

```typescript
export async function pollAndDispatch(consumerId: string): Promise<number> {
  const offset = await getConsumerOffset(consumerId);
  const events = await readChangesSince(offset);

  const handler = consumers.get(consumerId);
  if (!handler) return offset;

  // Process sequentially in LSN order
  for (const event of events) {
    await handler(event);
  }

  // Update offset only after entire batch succeeds
  if (events.length > 0) {
    await setConsumerOffset(consumerId, events[events.length - 1].lsn);
  }

  return events.length > 0 ? events[events.length - 1].lsn : offset;
}
```

### Common Mistakes
- **Mistake**: Processing events with `Promise.all()`.
- **Why it breaks**: Events complete out of order. An UPDATE may finish before its INSERT.
- **How to avoid**: Always process in a single `for...of` loop.

## Step 4: Build Idempotent Consumers

```typescript
export async function handleCacheUpdate(event: ChangeEvent): Promise<void> {
  if (event.operation === 'INSERT' || event.operation === 'UPDATE') {
    cache.set(`user:${event.after?.id}`, event.after);
  } else if (event.operation === 'DELETE') {
    cache.delete(`user:${event.before?.id}`);
  }
}
```

### Common Mistakes
- **Mistake**: Sending an email notification without deduplication.
- **Why it breaks**: Consumer replays = duplicate emails.
- **How to avoid**: Store `lastProcessedLsn` per consumer and deduplicate by LSN.

## Step 5: Validate Offsets

```typescript
const maxLsn = await getLatestLsn();
if (offset > maxLsn) {
  console.warn(`Offset ${offset} is ahead of max LSN ${maxLsn}. Resetting.`);
  await setConsumerOffset(consumerId, maxLsn);
  offset = maxLsn;
}
```

### Common Mistakes
- **Mistake**: Trusting consumer offsets without validation.
- **Why it breaks**: Corrupted offsets skip events permanently.
- **How to avoid**: Always validate offset against `MAX(lsn)`.
