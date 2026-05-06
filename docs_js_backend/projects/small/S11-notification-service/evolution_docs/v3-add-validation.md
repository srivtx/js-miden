# v3 — Adding Validation

Now you have SQLite. Notifications persist. But someone just sent:

```json
{ "user_id": "", "title": "", "body": "" }
```

Your database accepted it. You have a notification with no content for a non-existent user.

Another issue: every "like" creates a new row. A viral post generates 10,000 notifications. The user's inbox is unusable.

## The Fix: Validation + Aggregation

You add `zod` for validation.

```ts
import { z } from 'zod';

const NotifySchema = z.object({
  user_id: z.string().min(1),
  type: z.enum(['general', 'like', 'comment', 'mention', 'follow']),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
});
```

And you add an unread counter table.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  unread_count INTEGER DEFAULT 0
);
```

## The Race Condition

You update the unread count like this:

```ts
const userRow = db.prepare('SELECT unread_count FROM users WHERE id = ?').get(user_id);
const newCount = (userRow?.unread_count || 0) + 1;
db.prepare('UPDATE users SET unread_count = ? WHERE id = ?').run(newCount, user_id);
```

Under concurrent notifications, two reads see `count = 5`, both compute `6`, both write `6`. One notification is lost from the count.

**Fix:** Atomic increment.

```ts
db.prepare('UPDATE users SET unread_count = unread_count + 1 WHERE id = ?').run(user_id);
```

## Aggregation

Instead of 500 "like" rows, you aggregate:

```sql
-- When a like comes in, increment an existing aggregate or create one
INSERT INTO notifications (user_id, type, title, body, count)
VALUES (?, 'like', ?, ?, 1)
ON CONFLICT(user_id, type, reference_id)
DO UPDATE SET count = count + 1, body = ?, updated_at = ?
```

Now the user sees "Alice and 499 others liked your post" instead of 500 individual rows.

**Next:** Let's add logging and real-time delivery.
