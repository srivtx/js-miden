# S11 Notification Service — Performance

## Race Condition Throughput Impact

The read-modify-write pattern on `unread_count` serializes poorly:
- **Atomic increment**: ~1,000+ ops/sec (SQLite write lock bound).
- **Read-modify-write**: ~200–300 ops/sec because the read and write are separate statements.

## SSE Connection Overhead

Each SSE connection:
- Holds a TCP socket (~2–4 KB kernel buffer).
- Maintains a Response object in V8 heap.

For 1,000 concurrent viewers:
- Memory: ~4 MB for sockets + V8 overhead.
- SQLite reads: Near-zero if we only push on mutation (event-driven).

## Database Query Performance

### Inbox Query
```sql
SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?;
```

**With index on `(user_id, created_at DESC)`**: O(log n) index seek + O(limit) row retrieval.
**Without index**: Full table scan → O(n).

### Offset Penalty
`OFFSET 10000` forces SQLite to scan and discard 10,000 rows. Cursor pagination avoids this:
```sql
SELECT * FROM notifications
WHERE user_id = ? AND created_at < ?
ORDER BY created_at DESC LIMIT ?;
```

## Aggregation vs. Individual Rows

For a popular post receiving 1,000 likes:
- **Individual rows**: 1,000 INSERTs, 1,000 counter increments, inbox spam.
- **Aggregation**: 1 INSERT + 999 UPSERTs on aggregation table, inbox stays clean.

**CPU savings**: ~80% fewer inbox queries and render cycles.

## Caching Strategies

- **Unread count in Redis**: `GET user:alice:unread_count` → sub-millisecond reads.
- **Notification list cache**: Cache the first page for 5 seconds; invalidate on write.
- **Edge caching**: Not applicable for personalized feeds; use CDN only for static assets.
