# Troubleshooting

## Feed Shows Duplicates

**Symptom:** Same post appears multiple times when scrolling.

**Cause:** Offset pagination shifts when new posts arrive.

**Fix:**
```typescript
// Use cursor instead of offset
const cursor = req.query.cursor as string;
const [lastId, lastTimestamp] = cursor.split(':');

const feed = await db.query(`
  SELECT post_id FROM feed_items 
  WHERE user_id = $1 
  AND (created_at, post_id) < ($2, $3)
  ORDER BY created_at DESC, post_id DESC
  LIMIT $4
`, [userId, lastTimestamp, lastId, limit]);
```

## Post Creation is Slow

**Symptom:** POST /api/posts takes 30+ seconds.

**Cause:** Synchronous fan-out to all followers.

**Fix:** Use async job queue:
```typescript
await queue.add('fan-out', { postId: post.id });
res.status(201).json(post); // Immediate response
```

## Redis Memory Full

**Symptom:** Redis OOM errors.

**Cause:** Feeds growing unbounded.

**Fix:**
- Set max feed size (e.g., 1000 posts)
- Trim with `ZREMRANGEBYRANK feed:{userId} 0 -1001`
- Archive old posts to database
