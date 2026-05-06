# v3 — Adding Validation

Now you have SQLite. Votes persist across restarts. Life is better.

But someone just created a poll with no question and no options. Your database accepted it. Now you have a ghost poll that breaks your frontend.

Someone else voted with `option_id: 999999`. Your code tried to update a non-existent option and silently failed. The vote disappeared.

## The Fix: Validation

You add `zod` to enforce rules.

```ts
import { z } from 'zod';

const PollSchema = z.object({
  question: z.string().min(1).max(500),
  options: z.array(z.string().min(1)).min(2).max(20),
});

const VoteSchema = z.object({
  option_id: z.number().int().positive(),
});
```

Now:
- Empty question → rejected
- One option → rejected (need at least 2)
- `option_id: "abc"` → rejected
- `option_id: -1` → rejected

## Deduplication

You add IP-based tracking to prevent double-voting.

```ts
const existing = db.prepare('SELECT id FROM votes WHERE poll_id = ? AND ip = ?').get(pollId, ip);
if (existing) {
  return res.status(403).json({ error: 'Already voted' });
}
```

It's not perfect (VPNs, shared IPs), but it stops casual abuse.

## The Race Condition

Your vote handler reads the count, increments it in JavaScript, and writes it back:

```ts
const row = db.prepare('SELECT count FROM options WHERE id = ?').get(option_id);
const newCount = row.count + 1;
db.prepare('UPDATE options SET count = ? WHERE id = ?').run(newCount, option_id);
```

Under concurrent requests, two reads see `count = 5`, both compute `6`, both write `6`. One vote is lost.

**Fix:** Atomic increments.

```ts
db.prepare('UPDATE options SET count = count + 1 WHERE id = ?').run(option_id);
```

No read. No race. The database handles the lock.

**Next:** Let's add logging and real-time updates.
