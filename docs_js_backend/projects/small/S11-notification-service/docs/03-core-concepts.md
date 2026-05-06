# S11 Notification Service — Core Concepts

## Notification Aggregation

Social platforms receive bursts of similar events (likes, follows, mentions). Showing each individually creates inbox overload.

### Aggregation Logic
```typescript
function aggregate(userId: string, type: string, referenceId: string, actor: string) {
  const existing = db.prepare(
    'SELECT * FROM notification_aggregations WHERE user_id = ? AND type = ? AND reference_id = ?'
  ).get(userId, type, referenceId);

  if (existing) {
    db.prepare(
      'UPDATE notification_aggregations SET count = count + 1, latest_actor = ?, last_at = ? WHERE id = ?'
    ).run(actor, Date.now(), existing.id);
  } else {
    db.prepare(
      'INSERT INTO notification_aggregations (user_id, type, reference_id, count, latest_actor, last_at) VALUES (?, ?, ?, 1, ?, ?)'
    ).run(userId, type, referenceId, actor, Date.now());
  }
}
```

### Display Template
```
"{{latest_actor}} and {{count - 1}} others liked your post"
```

**Trade-offs**:
- **Individual rows**: Accurate but noisy.
- **Aggregated rows**: Compact but loses per-actor detail unless stored in a JSON array.

## Read Receipts

A read receipt records when a user saw a notification. The current implementation uses a boolean `read` column.

### Enhanced Version
```sql
ALTER TABLE notifications ADD COLUMN read_at INTEGER;
```

**Why it matters**:
- Analytics: "How long does it take users to open notifications?"
- Delivery confirmation: "Did the user actually see this alert?"
- Deduplication: Avoid re-sending notifications that were already viewed on another device.

## Notification Types

Different events require different handling:

| Type | Urgency | Aggregatable | Channels |
|------|---------|--------------|----------|
| `like` | Low | Yes | In-app only |
| `comment` | Medium | Yes | In-app + email digest |
| `mention` | High | No | In-app + push + email |
| `system` | Critical | No | In-app + push + SMS |

**Type-based routing**:
```typescript
if (notification.type === 'mention') {
  await sendPush(userId, notification.title);
  await sendEmail(userId, notification.body);
}
```

## Race Conditions in Counters

The current code contains a classic read-modify-write bug:

```typescript
const user = db.prepare('SELECT unread_count FROM users WHERE id = ?').get(userId);
const newCount = user.unread_count + 1;
db.prepare('UPDATE users SET unread_count = ? WHERE id = ?').run(newCount, userId);
```

### Why It Fails
If two requests arrive simultaneously:
1. **Request A** reads `count = 5`.
2. **Request B** reads `count = 5`.
3. **Request A** writes `count = 6`.
4. **Request B** writes `count = 6`.

**Result**: Two notifications created, but count only increased by one.

### Fix: Atomic Increment
```sql
UPDATE users SET unread_count = unread_count + 1 WHERE id = ?;
```

### Fix: Optimistic Locking
```sql
UPDATE users SET unread_count = unread_count + 1 WHERE id = ? AND unread_count = ?;
```

## Pagination Strategies

### Offset Pagination (Current)
```sql
SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?;
```
- **Pros**: Simple, stateless, easy to jump to page N.
- **Cons**: Performance degrades with large offsets (`OFFSET 100000` scans 100K rows), inconsistent results if new rows are inserted during browsing.

### Cursor Pagination
```sql
SELECT * FROM notifications
WHERE user_id = ? AND created_at < ?
ORDER BY created_at DESC LIMIT ?;
```
- **Pros**: O(1) performance regardless of depth, consistent snapshot.
- **Cons**: Cannot jump to arbitrary page, requires unique sort key.
- **Verdict**: Preferred for infinite-scroll feeds.
