# Critique Report: Project 7 — Social Feed Engine

**Reviewer:** Senior Technical Critic  
**Date:** 2026-05-06  
**Verdict:** The most dangerous project in the series. Contains a completely broken transaction pattern that students will copy directly, a cursor pagination implementation with a null-pointer bug, and a fan-out "fix" that loses data on server restarts.

---

## Severity Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 7 | 🔴 Must Fix |
| MAJOR | 10 | 🟠 Should Fix |
| MINOR | 8 | 🟡 Polish |
| MISSING | 8 | ⚪ Add |

---

## CRITICAL (Will Cause Incidents If Copied)

### C1. Completely Broken Transaction Pattern in Like Handler
**Location:** `src/routes/engagement.ts`, like endpoint  
**Issue:** The code does:
```typescript
await pool.query('BEGIN');
await pool.query('INSERT INTO likes ...');
await pool.query('UPDATE posts SET like_count = like_count + 1 ...');
await pool.query('COMMIT');
```
**This is not a transaction.** `pool.query('BEGIN')` acquires a random connection from the pool. The subsequent `pool.query()` calls may be dispatched to *different* connections. The `BEGIN`, `INSERT`, `UPDATE`, and `COMMIT` could run on four separate database sessions. This provides **zero atomicity guarantees** and will cause race conditions, deadlocks, and data corruption under load.  
**Fix:** Use `const client = await pool.connect(); await client.query('BEGIN'); ... await client.query('COMMIT'); client.release();`

### C2. Retweet Handler Has No Transaction At All
**Location:** `src/routes/engagement.ts`, retweet endpoint  
**Issue:** The retweet handler does an `INSERT` into `retweets`, an `UPDATE` on `posts`, and an `INSERT` into `user_post_engagements` as three separate `pool.query()` calls with no transaction wrapper. Any failure between them leaves the database inconsistent.  
**Fix:** Wrap in a client-based transaction.

### C3. `setImmediate` Fan-Out Loses Data on Crash
**Location:** Bug 1 fix in Section 5  
**Issue:** The "fixed" code uses:
```typescript
setImmediate(() => {
  fanOutPost(post.id, post.user_id).catch(console.error);
});
```
`setImmediate` schedules work on the same event loop tick. If the Node.js process crashes or is SIGKILLed before the callback executes, the fan-out is lost forever. The post exists but no follower ever sees it. There is no retry, no queue, no persistence.  
**Fix:** Use BullMQ, RabbitMQ, or at least a database-backed outbox table. `setImmediate` is not a job queue.

### C4. Cursor Pagination Bug for Celebrity Posts
**Location:** `src/services/feed.ts`, `getFeed()`  
**Issue:** When building the next cursor, the code does:
```typescript
const score = await redis.zscore(`feed:${userId}`, lastPost.id);
```
If `lastPost` came from the celebrity posts merge (not the user's normal feed), `zscore` returns `null`. The cursor object becomes `{ score: NaN, id: ... }`, and the next page query returns garbage or crashes.  
**Fix:** Track which source (normal vs celeb) each post came from, or query both sorted sets for the score.

### C5. Feed Deduplication Destroys Sort Order
**Location:** `src/services/feed.ts`  
**Issue:** `const allIds = [...new Set([...normalFeedIds, ...celebPostIds])];` merges two already-sorted lists, deduplicates them, and then slices by `limit`. But `Set` preserves insertion order — it does **not** re-sort by the Redis score. A high-score celebrity post could appear after a low-score normal post if the normal feed was queried first.  
**Fix:** Merge with a proper k-way merge sort by score, or store scores alongside IDs and sort in JavaScript.

### C6. No Redis Error Handling in Rate Limiter
**Location:** `src/middleware/rateLimit.ts` (implied, shown in Bug 3 fix)  
**Issue:** The rate limiter does `await redis.incr(key)`. If Redis is down, this throws an unhandled exception and returns a 500 instead of failing open or closed gracefully.  
**Fix:** Wrap in try/catch and decide on a safe default (fail open = allow request, or fail closed = 503).

### C7. `social-proof` Query Could Leak Data
**Location:** `src/routes/engagement.ts`, `/social-proof/:userId/:postId`  
**Issue:** The query joins `follows` to find "people you follow who liked this." While logically correct, it does not verify that the requesting user is actually `$1` (the `userId` param). Any authenticated user can query social proof for any other user by changing the URL parameter.  
**Fix:** Verify `req.user.id === req.params.userId` or use the authenticated user's ID directly.

---

## MAJOR (Outdated, Inefficient, or Brittle)

### M1. `follower_count` Cached Column Is a Cache Invalidation Bomb
**Location:** `sql/schema.sql`, `users` table  
**Issue:** The `users` table stores `follower_count` and `following_count`. Every follow/unfollow must update two rows atomically. The project never shows this logic, nor discusses cache invalidation. At scale, these counts drift and require periodic recalculation.  
**Fix:** Either remove the cached columns and compute `COUNT(*)` on read, or show the follow/unfollow transaction that keeps them in sync.

### M2. Missing Index on `follows(target_id)`
**Location:** `sql/schema.sql`  
**Issue:** The only index on `follows` is `UNIQUE(follower_id, target_id)`. `fanOutPost` queries `SELECT follower_id FROM follows WHERE target_id = $1`. PostgreSQL cannot efficiently use a `(follower_id, target_id)` index for `target_id`-only lookups without an index skip scan (not available until v16+ in limited form). At scale, this query sequential-scans.  
**Fix:** `CREATE INDEX idx_follows_target ON follows(target_id);`

### M3. Celebrity Post Fetch Is O(N × limit)
**Location:** `src/services/feed.ts`  
**Issue:** If a user follows 100 celebrities, the code fetches `limit` posts for *each* celebrity (up to 2,000 IDs), merges, deduplicates, and limits to 20. This is extremely inefficient and wastes Redis bandwidth.  
**Fix:** Use a Redis Lua script or maintain a merged "celeb feed" per user.

### M4. No Rate Limiting on Feed or Engagement Endpoints
**Location:** All read/write endpoints  
**Issue:** A single bot can scrape every user's feed, like every post, or create posts infinitely. The rate limiter is shown in the bug section but never actually applied to the working code.  
**Fix:** Apply Redis-based rate limiting to all endpoints.

### M5. `getFeed` Queries PostgreSQL with Unbounded `ANY` Array
**Location:** `src/services/feed.ts`  
**Issue:** `SELECT * FROM posts WHERE id = ANY($1::uuid[]) ORDER BY created_at DESC LIMIT $2` — if `allIds` is large (up to 2,000 from celebrity merge), PostgreSQL must sort all matching rows before limiting. The `LIMIT` is applied after the sort, not before.  
**Fix:** Limit `allIds` to a reasonable size before querying, or use a temp table / `VALUES` clause with an order-preserving join.

### M6. `posts` Table Has `like_count` Despite Warning Against It
**Location:** `sql/schema.sql` and Section 2  
**Issue:** The architecture section explicitly warns that `like_count` on the `posts` table causes row-level lock contention. Then the schema includes `like_count` and `retweet_count` columns, and the engagement handlers update them. The very bug the project warns about is baked into the reference implementation.  
**Fix:** Remove the counts from `posts` and use Redis counters with background sync, as described in the architecture.

### M7. `composeRedisScore` Precision Risk
**Location:** `src/services/ranking.ts`  
**Issue:** `return timeComponent * 1000 + normalizedScore;` where `timeComponent = Date.now()` (~1.7e12). The result is ~1.7e15. JavaScript safe integer limit is 9e15, so this is fine today. But if `timeComponent` grows or the multiplier changes, this could exceed `Number.MAX_SAFE_INTEGER` and cause sorting corruption in Redis.  
**Fix:** Use string-based composite scores or ensure the math stays within safe integer bounds with explicit bounds checking.

### M8. Redis LRU Policy Evicts Feed Data
**Location:** `docker-compose.yml`  
**Issue:** Redis is configured with `--maxmemory-policy allkeys-lru`. If memory pressure hits, Redis will evict users' feed keys. A user logs in and their entire feed history is gone.  
**Fix:** Use `noeviction` for feed storage, or set explicit TTLs on non-critical keys and use `volatile-lru`.

### M9. No Cleanup for Deleted Posts in Redis Feeds
**Location:** Entire project  
**Issue:** If a user deletes a post, the post ID remains in every follower's Redis feed. The `getFeed` query will return fewer results than expected because deleted posts are filtered out by PostgreSQL but still occupy slots in the Redis `ZRANGE`.  
**Fix:** Discuss a background cleaner or soft-delete pattern that removes IDs from feeds.

### M10. ` Buffer.from(cursor, 'base64')` Can Throw
**Location:** `src/services/feed.ts`  
**Issue:** If a user manipulates the cursor to an invalid base64 string, `Buffer.from` succeeds but `JSON.parse` may throw. The error bubbles up as a 500.  
**Fix:** Wrap in try/catch and return 400 Bad Request for malformed cursors.

---

## MINOR (Typos, Inconsistencies, Edge Cases)

1. **Schema `posts` table uses `PARTITION BY RANGE` but no default partition:** If a post is inserted with a future `created_at` beyond the pre-created partitions, PostgreSQL throws an error.
2. **`user_post_engagements` missing `ON DELETE CASCADE` on `post_id`:** Deleting a post leaves orphaned engagement records.
3. **Typo in `idx_posts_parent` index:** `WHERE parent_id IS NOT NULL` is fine, but if most posts are top-level, this partial index is small. If most are replies, it's large. The trade-off isn't discussed.
4. **Inconsistent use of `pool` vs `client` in `fanOutPost`:** The function uses `pool.connect()` correctly but doesn't handle the case where `client.query()` throws before `finally`.
5. **No `return` after `res.json()` in some route handlers:** Not all routes show explicit returns, though Express doesn't strictly require them.
6. **The `getFeed` cursor logic uses `minScore = '-inf'` as string:** This works with `ioredis` but relies on Redis command serialization. Should be explicitly typed.
7. **Missing `await` on `redis.publish()` in fan-out:** Not shown, but if progress pub/sub is used, failed publishes are unhandled.
8. **Celebrity threshold is hardcoded at 100,000:** No discussion of how to tune this or measure the fan-out latency.

---

## MISSING (What Should Be Covered)

1. **Unfollow handling:** When a user unfollows someone, their feed should be cleaned up. Not mentioned.
2. **Post editing:** If a post is edited, the cached version in Redis feeds is stale. No invalidation strategy.
3. **Blocking / muting users:** A real social feed must filter out blocked users. Not discussed.
4. **Feed warm-up for new users:** When a new user follows 1,000 accounts, how is their initial feed built? Backfill is expensive and unmentioned.
5. **Read-after-write consistency:** User creates a post, immediately refreshes feed. Will they see it? The async fan-out means "maybe not."
6. **Redis Cluster for feed sharding:** At scale, a single Redis instance cannot hold all feeds. No mention of clustering or consistent hashing.
7. **Soft deletes:** The schema uses `ON DELETE CASCADE` everywhere. No soft-delete discussion for content moderation holds or user-initiated deletes.
8. **The "write hole":** What if `fanOutPost` fails after the post is created? The post exists but reaches zero followers. No retry or detection mechanism.

---

## EDUCATIONAL QUALITY

### What Works
- **The fan-out strategy explanation** (push vs pull vs hybrid) is the clearest explanation of this concept I've seen in educational material. The celebrity threshold math is compelling.
- **Bug 2 (Offset Pagination)** is a perfect teaching moment — every junior engineer has built this bug.
- **Bug 5 (Hot Partitions)** connects database internals (B-tree hot edges) to real-world scaling limits. Excellent.

### What Fails
- **C1 (Broken Transaction) is unforgivable.** This is not an "intentional bug" — it's a subtle architectural misunderstanding that the *author* appears to have. Students will copy this code and ship corrupted databases. This pattern appears in the *working* code, not the bug section.
- **Bug 1's "fix" (`setImmediate`) is worse than the bug.** Teaching students that `setImmediate` is an acceptable async job mechanism is dangerous. It survives neither crashes nor restarts. The fix should introduce a real queue.
- **Bug 4 (Race Condition)** is presented as "read-modify-write is bad, use atomic UPDATE." But the actual code doesn't even do a proper transaction! The fix in the bug section doesn't fix the transaction isolation issue shown in the working code.
- **The schema includes `like_count` after explicitly arguing against it.** This is either hypocritical or careless.

### Recommendation
**This project requires a full rewrite of the transaction code before it can be used.**
1. Replace all `pool.query('BEGIN')` with proper `client = await pool.connect(); client.query('BEGIN')` patterns.
2. Remove `setImmediate` and introduce BullMQ for fan-out.
3. Fix the `getFeed` cursor logic to handle celebrity post scores.
4. Either remove `like_count` from the schema or add Redis counters with background sync as the working implementation.
5. Add `ON DELETE CASCADE` to `user_post_engagements(post_id)`.

---

*End of Critique P7*
