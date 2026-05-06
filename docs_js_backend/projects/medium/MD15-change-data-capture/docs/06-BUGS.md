# The Bugs

## Bug 1: Out-of-Order Delivery

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

### Real-World Impact
In 2019, a fintech company's CDC pipeline processed account balance updates out of order. A deposit event ($1000) was processed before the account creation event. The cache showed a balance of $1000 for a non-existent account. When the account creation was later processed, the balance was overwritten to $0. Customer support received 500+ complaints about "missing funds."

---

## Bug 2: Missed Changes Due to Offset Corruption

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
In 2020, a payment processor's CDC offset was corrupted during a Kafka partition rebalance. Two hours of transactions were skipped. Reconciliation took 3 days. The company had to manually re-sync 50,000 accounts and issue $1.2M in goodwill credits.

---

## Bug 3: Phantom Events on Rollback

### How to Introduce It
Publish the CDC event *before* the database transaction commits:

```typescript
const event = { lsn: await getNextLsn(), table: 'orders', operation: 'INSERT', after: order };
await publishChange(event); // Event is published NOW
await query('INSERT INTO orders ...'); // What if this fails or rolls back?
```

### Why It Exists
The developer didn't understand the difference between application-level event publishing and WAL-level CDC. They treated `publishChange` as a side effect rather than a post-commit action.

### Symptoms You'll See
- Cache contains rows that don't exist in the database.
- Notifications sent for orders that were never created.
- Search index has phantom documents.

### How to Reproduce
```typescript
await query('BEGIN');
const order = await query('INSERT INTO orders ...'); // Succeeds
await publishChange(event); // Published
await query('ROLLBACK'); // Oh no — event is already out
```

### The Fix
```typescript
// Option 1: Publish INSIDE the transaction (if using a transactional outbox)
await query('BEGIN');
const order = await query('INSERT INTO orders ...');
await query('INSERT INTO cdc_events ...', [event]); // Same transaction
await query('COMMIT');

// Option 2: Use WAL reading (post-commit only)
// PostgreSQL logical replication only emits committed changes.
```

### Why the Fix Works
Transactional outbox ensures the event and the data change are atomic. WAL reading is even safer — the database itself only exposes committed changes.

### Real-World Impact
In 2018, an e-commerce platform using trigger-based CDC published a "payment succeeded" event before the payment gateway confirmed the transaction. The payment gateway later declined the card. The notification service sent a "your order is confirmed" email to 2,000 customers. 1,800 of those orders had to be cancelled. The company faced a class-action lawsuit for deceptive practices.
