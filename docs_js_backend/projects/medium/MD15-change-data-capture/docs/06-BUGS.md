# The Bugs

## Bug 1: Missed Changes

### How to Introduce It
Allow the consumer offset to jump past valid events without validation:

```typescript
const offset = await getConsumerOffset(consumerId);
const events = await readChangesSince(offset); // If offset = 999999 and max_lsn = 100, returns []
```

### Why It Exists
The developer assumed offsets would only advance via the normal dispatch loop. They didn't consider manual tampering, bad backups, or clock skew in distributed offset stores.

### Symptoms You'll See
- Cache entries never update for new rows.
- Notifications stop sending.
- Consumer offset is far ahead of `MAX(lsn)` in `cdc_events`.

### How to Reproduce
```sql
UPDATE cdc_offsets SET last_lsn = 999999 WHERE consumer_id = 'cache';
```
Then insert a new row. The consumer will never see it.

### The Fix
```typescript
const maxLsn = await getLatestLsn();
if (offset > maxLsn) {
  console.warn(`Offset ${offset} is ahead of max LSN ${maxLsn}. Resetting.`);
  await setConsumerOffset(consumerId, maxLsn);
  offset = maxLsn;
}
```

### Why the Fix Works
By validating the offset against the actual WAL/event log, we detect corruption and reset gracefully.

### Real-World Impact
In 2020, a payment processor's CDC offset was corrupted during a Kafka partition rebalance. Two hours of transactions were skipped. Reconciliation took 3 days.

## Bug 2: Out-of-Order Delivery

### How to Introduce It
Dispatch events concurrently with `Promise.all()`:

```typescript
await Promise.all(
  events.map(async (event) => {
    await handler(event);
    await setConsumerOffset(consumerId, event.lsn);
  })
);
```

### Why It Exists
The developer wanted "faster" processing and didn't realize that `Promise.all()` destroys ordering guarantees.

### Symptoms You'll See
- Cache shows stale data (UPDATE applied before INSERT).
- Search index has documents for rows that were deleted.
- Notification sent for a row that doesn't exist yet.

### How to Reproduce
1. Insert a user.
2. Immediately update the user's name.
3. The consumer may cache the old name because INSERT finished after UPDATE.

### The Fix
```typescript
for (const event of events) {
  await handler(event);
}
if (events.length > 0) {
  await setConsumerOffset(consumerId, events[events.length - 1].lsn);
}
```

### Why the Fix Works
Sequential processing guarantees LSN ordering. The offset is updated only after the entire batch succeeds, so a crash causes replay from the last safe point.
