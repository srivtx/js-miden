# S11 Notification Service — Database

## Schema

```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  unread_count INTEGER NOT NULL DEFAULT 0
);
```

## Data Types

### `read` (`INTEGER DEFAULT 0`)
SQLite lacks a native boolean. `0` = unread, `1` = read. In PostgreSQL, prefer `BOOLEAN`.

### `data` (`TEXT`)
JSON string for flexible payloads (e.g., `{"post_id": 42, "actor_avatar": "..."}`). In PostgreSQL, use `JSONB` for indexing and partial extraction.

### `created_at` (`INTEGER`)
Unix timestamp in milliseconds. Enables efficient range queries and cursor pagination.

## Indexes

```sql
-- Primary listing query
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- Unread count query (if using dynamic COUNT)
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);
```

## Decision: Denormalized Counter vs. Dynamic COUNT

### Alternative 1: Denormalized Counter (Current)
The `users.unread_count` column is updated on every create and read action.
- **Pros**: O(1) reads, no table scans, trivial SSE payload generation.
- **Cons**: Race conditions cause drift; requires reconciliation jobs.
- **Verdict**: Best for high-read workloads where slight inaccuracy is acceptable.

### Alternative 2: Dynamic COUNT(*)
```sql
SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read = 0;
```
- **Pros**: Always accurate, single source of truth.
- **Cons**: O(n) scan; performance degrades with large inboxes.
- **Verdict**: Best for small inboxes (<10K notifications).

### Alternative 3: Trigger-Maintained Counter
```sql
CREATE TRIGGER increment_unread
AFTER INSERT ON notifications
BEGIN
  INSERT INTO users (id, unread_count) VALUES (NEW.user_id, 1)
  ON CONFLICT(id) DO UPDATE SET unread_count = unread_count + 1;
END;
```
- **Pros**: Accurate and fast; database guarantees consistency.
- **Cons**: SQLite triggers add overhead per write; harder to debug.
- **Verdict**: Good when you want denormalized speed with database-enforced correctness.

## Aggregation Schema (Phase 2+)

```sql
CREATE TABLE notification_aggregations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  latest_actor TEXT,
  last_at INTEGER NOT NULL,
  UNIQUE(user_id, type, reference_id)
);
```

**Index**:
```sql
CREATE INDEX idx_aggregations_user ON notification_aggregations(user_id, last_at DESC);
```
