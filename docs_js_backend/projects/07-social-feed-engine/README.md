# Project 7: Social Feed Engine

> **Stack:** Node.js 22, Express 5, TypeScript (ESM), PostgreSQL 16, Redis 7, pnpm  
> **Concepts:** Fan-out strategies, celebrity problem, feed ranking, materialized views, cursor pagination, time-series partitioning

---

## Section 1: The Brief (WHAT)

### Requirements Breakdown

The client wants a Twitter-like social feed. This sounds simple on the surface — "show me posts from people I follow" — but the intersection of **scale**, **relevance**, and **real-time** makes it one of the hardest problems in backend engineering.

**Functional Requirements:**
1. Users can follow/unfollow other users
2. Users create posts (text + optional media)
3. Followers see posts in their home feed
4. Feed must be sorted by relevance, not just chronology
5. Users can like, retweet, and reply to posts
6. Show social proof: "5 people you follow liked this"
7. Pagination that never misses posts or shows duplicates

**Non-Functional Requirements:**
1. Handle users with 1M+ followers (the "celebrity problem")
2. Feed load time < 100ms at p99
3. Post creation < 200ms even for celebrities
4. Support millions of DAU

### User Stories

- **As a regular user**, I want my post to appear in my followers' feeds within seconds, so they see what I'm sharing in real-time.
- **As a follower**, I want to scroll through my feed and see the most interesting posts first, not just the newest ones.
- **As a follower**, I want to keep scrolling without seeing the same post twice or missing posts because new ones arrived.
- **As a user**, I want to see that people I know engaged with a post, so I know it's worth reading.
- **As a celebrity**, I want to post without crashing the platform or waiting 30 seconds for the post to publish.

### Core Problem: Fan-out + Relevance + Real-time = Hard

If you have 1,000 followers and post once, you create **1,000 feed entries**. If a celebrity has 100M followers and posts once, you create **100M feed entries**. In the same second, 10,000 regular users might post, creating millions more entries.

Now sort all of those by relevance. Now paginate through them without duplicates. Now do it in real-time.

This is why Twitter had the "Fail Whale" for years. This problem is hard.

---

## Section 2: Architecture (WHY)

### Hybrid Fan-out: Push for Normal Users, Pull for Celebrities

```
NORMAL USER (500 followers):
  Post created
    -> Fan-out service pushes post ID to 500 Redis sorted sets
    -> Done in ~50ms

CELEBRITY (10M followers):
  Post created
    -> NO fan-out happens
    -> Post stored in "celebrity posts" key
    -> When user loads feed, we MERGE:
       1. Their pre-computed feed (normal users)
       2. Celebrity posts from people they follow (fetched on read)
```

**WHY hybrid?** If Elon Musk posts and we push to 100M followers' Redis feeds, that's 100M Redis writes. At 1ms per write, that's 27 hours. Even parallelized across 1,000 workers, it's still 100 seconds of pure Redis CPU time. Your database will cry.

**WHAT IF WE ONLY USE PUSH?** Celebrity posts take minutes or hours to fan-out. By the time followers see it, the news cycle has moved on. Or your Redis cluster runs out of memory because you're storing 100M copies of the same post ID.

**WHAT IF WE ONLY USE PULL?** Every feed load requires a JOIN across the `follows` table and `posts` table: `SELECT posts.* FROM posts JOIN follows ON posts.user_id = follows.target_id WHERE follows.follower_id = ? ORDER BY created_at DESC LIMIT 20`. For a user following 5,000 people, this is a nightmare query that gets slower the more people they follow.

### Why Redis Sorted Sets for Feeds?

Redis sorted sets (`ZADD`, `ZRANGEBYSCORE`) give us:
- **O(log n)** insertion per element
- **O(log n + m)** range queries (where m is the number of results)
- **Atomic** operations
- **Score-based sorting** — we can use a composite score of `time + engagement`

```
ZADD feed:user:1234 <score> <post_id>
ZRANGE feed:user:1234 0 19 WITHSCORES DESC
```

**WHAT IF WE USE A LIST?** Redis lists (`LPUSH`, `LRANGE`) only support index-based retrieval. If you want "posts from the last 3 hours with score > 100," you can't do it efficiently. You'd have to scan the entire list.

**WHAT IF WE USE PostgreSQL?** A query like `SELECT * FROM feed_items WHERE user_id = ? ORDER BY score DESC LIMIT 20 OFFSET 0` requires an index scan + sort. At 10M feed items per user (over time), this index gets huge. Worse, `OFFSET 10000` forces PostgreSQL to scan and discard 10,000 rows. Your p99 feed load becomes 5 seconds.

### Why NOT Just JOIN Posts + Follows in PostgreSQL?

The naive approach:
```sql
SELECT posts.* FROM posts
JOIN follows ON posts.user_id = follows.target_id
WHERE follows.follower_id = $1
ORDER BY posts.created_at DESC
LIMIT 20 OFFSET $2;
```

This works for 100 users. It dies at 10k users because:
1. The query planner can't efficiently use indexes when filtering on `follows.follower_id` AND sorting by `posts.created_at`
2. The JOIN produces a massive intermediate result set before LIMIT
3. OFFSET gets linearly slower
4. You can't pre-compute relevance scores without materializing the feed

**WHAT IF WE TRY ANYWAY?** Twitter tried this in 2006. It fell over. They invented the Redis feed cache specifically because this query couldn't scale.

### Why Materialized Views or Pre-Computed Feeds?

A materialized feed is: "When Alice follows Bob, Bob's future posts get copied into Alice's feed storage." This is **write-time denormalization**.

**Trade-off:** We accept slower writes (fan-out) for O(1) reads (fetch pre-computed feed).

**WHAT IF WE DON'T PRE-COMPUTE?** Every feed read is a complex real-time query across multiple tables. Your read DB melts under load. You add read replicas, but now you have replication lag and users see stale feeds.

### Why Cursor Pagination Over Offset?

**Offset pagination:**
```
Page 1: LIMIT 20 OFFSET 0   -> posts 1-20
[5 NEW POSTS ARRIVE]
Page 2: LIMIT 20 OFFSET 20  -> posts 20-39 (posts 15-19 are duplicated!)
```

**Cursor pagination:**
```
Page 1: LIMIT 20 (no cursor) -> posts 1-20, return "next_cursor: score=12345,id=abc"
[5 NEW POSTS ARRIVE]
Page 2: LIMIT 20 WHERE (score < 12345) OR (score = 12345 AND id < 'abc')
  -> posts 21-40, no duplicates, no missing posts
```

**WHY?** Offset is relative to the result set position. If the result set changes between requests, positions shift. Cursor is absolute — it pins to a specific boundary in the data.

**WHAT IF WE USE OFFSET?** Users scroll, see duplicates, get angry, leave your app. Or worse, they miss critical posts because new ones pushed the old ones down.

### Why Separate Like/Retweet Counts from Post Table?

If the `posts` table has `like_count` and `retweet_count` columns, every like does:
```sql
UPDATE posts SET like_count = like_count + 1 WHERE id = $1;
```

This creates **row-level lock contention** on the post row. If 10,000 people like a viral post simultaneously, they all queue up waiting for the same row lock. Your database grinds to a halt.

**Better approach:** Use Redis counters for real-time counts, sync to PostgreSQL periodically.

```
User likes post -> INCR post:likes:123
                -> Background job writes to PostgreSQL every 10 seconds
```

**WHAT IF WE KEEP COUNTS IN THE POST TABLE?** Viral posts create hot rows. PostgreSQL's row-level locking means all like updates serialize. Your 10k QPS like storm becomes 100 QPS because each update waits for the previous lock.

---

## Section 3: NEW Concepts (Inline Teaching)

### 1. Fan-out Strategies: Push vs Pull vs Hybrid

**WHAT IS IT?**
- **Push (Fan-out on write):** When a user posts, push the post ID into every follower's feed storage immediately.
- **Pull (Fan-out on read):** When a user loads their feed, query all the people they follow and assemble the feed in real-time.
- **Hybrid:** Push for users with <N followers, pull for celebrities with >N followers.

**WHY USE IT HERE?**
Push gives O(1) feed reads. Pull handles celebrity scale. Hybrid gets us both.

**WHAT HAPPENS IF WE DON'T?**
- Pure push: Celebrity posts kill the system. 100M Redis writes = bad day.
- Pure pull: Regular users' feed loads get slower the more people they follow. Following 5,000 people = 5-second load times.

**Implementation:**
```typescript
// src/services/fanout.ts
import Redis from 'ioredis';
import { Pool } from 'pg';

const redis = new Redis(process.env.REDIS_URL);
const pg = new Pool({ connectionString: process.env.DATABASE_URL });

const CELEBRITY_THRESHOLD = 100_000;

export async function fanOutPost(postId: string, authorId: string): Promise<void> {
  // 1. Get follower count
  const { rows } = await pg.query(
    'SELECT COUNT(*) FROM follows WHERE target_id = $1',
    [authorId]
  );
  const followerCount = parseInt(rows[0].count, 10);

  // 2. Celebrity? Don't push. Store in celebrity index.
  if (followerCount > CELEBRITY_THRESHOLD) {
    await redis.zadd(`celebrity:posts:${authorId}`, Date.now(), postId);
    return;
  }

  // 3. Normal user: get followers and push via pipeline
  const followers = await pg.query(
    'SELECT follower_id FROM follows WHERE target_id = $1',
    [authorId]
  );

  if (followers.rows.length === 0) return;

  const pipeline = redis.pipeline();
  const score = Date.now(); // We'll refine this with engagement later

  for (const row of followers.rows) {
    pipeline.zadd(`feed:${row.follower_id}`, score, postId);
    // Trim feeds to last 5,000 items to control memory
    pipeline.zremrangebyrank(`feed:${row.follower_id}`, 0, -5001);
  }

  await pipeline.exec();
}
```

### 2. The Celebrity Problem

**WHAT IS IT?** When a user with a massive follower count (celebrity, brand, politician) posts, the system must handle an outsized write/load spike.

**WHY USE IT HERE?** One celebrity post can generate more write volume than 100,000 normal users combined. Without special handling, a single tweet from a pop star can DDOS your own infrastructure.

**WHAT HAPPENS IF WE DON'T?**
- In 2010, Twitter's Fail Whale appeared when celebrities posted because fan-out overloaded their Redis clusters.
- Your post creation API times out for celebrities. They complain on Instagram. Your startup dies.

**Implementation:**
```typescript
// src/services/feed.ts
export async function getFeed(userId: string, cursor?: string, limit = 20) {
  // 1. Get IDs of celebrities the user follows
  const { rows: celebFollows } = await pg.query(
    `SELECT target_id FROM follows
     WHERE follower_id = $1
     AND target_id IN (
       SELECT target_id FROM follows
       GROUP BY target_id
       HAVING COUNT(*) > $2
     )`,
    [userId, CELEBRITY_THRESHOLD]
  );

  const celebIds = celebFollows.map(r => r.target_id);

  // 2. Fetch normal feed from Redis
  let args: (string | number)[] = [`feed:${userId}`, '+', '-', 'LIMIT', 0, limit];
  if (cursor) {
    const [maxScore, maxId] = cursor.split(':');
    // ZRANGEBYSCORE feed:user 0 (maxScore  -- but we need tie-breaking
    // For simplicity, we use ZREVRANGEBYSCORE with offset in a real app,
    // or we use the lexicographic cursor pattern.
    args = [`feed:${userId}`, maxScore, '-', 'LIMIT', 0, limit];
  }
  const normalFeed = await redis.zrevrangebyscore(...args as [string, string, string, string, number, number]);

  // 3. If following celebrities, fetch their recent posts and merge
  let celebrityPosts: string[] = [];
  if (celebIds.length > 0) {
    const celebPipeline = redis.pipeline();
    for (const cid of celebIds) {
      celebPipeline.zrevrange(`celebrity:posts:${cid}`, 0, 50);
    }
    const celebResults = await celebPipeline.exec();
    celebrityPosts = celebResults?.flatMap(([err, res]) => (err ? [] : (res as string[]))) ?? [];
  }

  // 4. Merge, deduplicate, sort by score, and return
  const allPostIds = [...new Set([...normalFeed, ...celebrityPosts])];
  // In production, fetch post details from DB/cache and sort by computed score
  return allPostIds.slice(0, limit);
}
```

### 3. Feed Ranking Algorithms

**WHAT IS IT?** Instead of `ORDER BY created_at DESC`, we compute a relevance score for each post combining time decay and engagement.

**WHY USE IT HERE?** Chronological feeds bury great posts. Algorithmic feeds keep users engaged. The score must be computable at write-time (for push) so we don't re-calculate on every read.

**WHAT HAPPENS IF WE DON'T?**
- Users miss great posts from 3 hours ago because 50 mediocre posts happened since.
- You re-calculate engagement scores on every feed load = O(n log n) per user per request = database death.

**Simple Algorithm (Hacker News / Reddit style):**
```
score = (engagement_score) / ((age_in_hours + 2) ^ gravity)
```

**Implementation:**
```typescript
// src/services/ranking.ts
export function calculateFeedScore(
  likeCount: number,
  retweetCount: number,
  replyCount: number,
  createdAt: Date,
  gravity = 1.8
): number {
  const engagementScore = (likeCount * 1) + (retweetCount * 2) + (replyCount * 3);
  const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  const denominator = Math.pow(hoursSinceCreation + 2, gravity);
  return engagementScore / denominator;
}

// When fanning out, compute score and store in Redis:
const score = calculateFeedScore(0, 0, 0, new Date(), 1.8);
// We multiply by 1e12 and add timestamp to preserve time-ordering as tie-breaker:
const redisScore = score * 1e12 + Date.now();
pipeline.zadd(`feed:${followerId}`, redisScore, postId);
```

### 4. Materialized Views (Pre-Computed Feeds)

**WHAT IS IT?** A feed item table that is a denormalized copy of posts, specifically structured for fast reading by a particular user.

**WHY USE IT HERE?** The "view" (the feed) is materialized into physical storage (Redis sorted sets) so reads are O(log n) instead of O(join + sort).

**WHAT HAPPENS IF WE DON'T?** Every feed refresh runs a complex query. At scale, this is unsustainable. You end up adding caching layers anyway — so design for the cache from day one.

**Implementation:** See the Redis sorted set fan-out above. The Redis key `feed:user:1234` IS the materialized view for user 1234.

### 5. Time-Series Data and Hot Partitions

**WHAT IS IT?** Posts have a natural time dimension. All writes go to "now," creating a "hot" partition or table that receives all INSERT load.

**WHY USE IT HERE?** If all posts go into `posts` table with an index on `created_at`, the rightmost side of the B-tree (the "hot edge") is constantly being updated, creating contention.

**WHAT HAPPENS IF WE DON'T?**
- Write throughput is limited by how fast one PostgreSQL partition/index can handle INSERTs.
- In 2012, Instagram sharded by time because their single `photos` table couldn't keep up with new photo inserts.

**Implementation (conceptual — PostgreSQL native partitioning):**
```sql
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE posts_2025_01 PARTITION OF posts
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE posts_2025_02 PARTITION OF posts
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- etc.
```

### 6. Aggregation Pipelines (Redis Pipelines)

**WHAT IS IT?** Batching multiple Redis commands into a single network round-trip.

**WHY USE IT HERE?** Fanning out to 10,000 followers means 10,000 Redis commands. Without pipelining, that's 10,000 network round-trips. With pipelining, it's 1 round-trip.

**WHAT HAPPENS IF WE DON'T?** Fan-out latency goes from 50ms to 10 seconds. Your post creation API times out.

**Implementation:** See `pipeline.zadd()` in the fan-out service above.

### 7. Feed Deduplication

**WHAT IS IT?** When user B retweets user A's post, a follower of both might see the post twice: once from A, once from B's retweet.

**WHY USE IT HERE?** Deduplicated feeds feel professional. Duplicate feeds feel broken.

**WHAT HAPPENS IF WE DON'T?** Users see the same meme 4 times in a row and uninstall your app.

**Implementation:**
```typescript
// When adding to feed, use the ORIGINAL post ID, not the retweet ID
// Retweets are stored separately but point to the original post ID

// In getFeed:
const uniquePostIds = [...new Set(allPostIds)];
```

---

## Section 4: Step-by-Step Build Guide

### Prerequisites

```bash
# Create project
mkdir social-feed-engine && cd social-feed-engine
pnpm init
pnpm add express@^5.0.0 ioredis pg zod dotenv
pnpm add -D typescript @types/express @types/node tsx nodemon
```

### 1. Project Structure

```
social-feed-engine/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   └── redis.ts
│   ├── routes/
│   │   ├── posts.ts
│   │   ├── feed.ts
│   │   └── engagement.ts
│   ├── services/
│   │   ├── fanout.ts
│   │   ├── feed.ts
│   │   └── ranking.ts
│   ├── middleware/
│   │   └── rateLimit.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── sql/
│   └── schema.sql
├── docker-compose.yml
├── .env
├── tsconfig.json
└── package.json
```

### 2. Configuration Files

**package.json:**
```json
{
  "name": "social-feed-engine",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "nodemon --exec tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "psql $DATABASE_URL -f sql/schema.sql"
  },
  "dependencies": {
    "dotenv": "^16.4.0",
    "express": "^5.0.0",
    "ioredis": "^5.4.0",
    "pg": "^8.13.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "nodemon": "^3.1.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

**.env:**
```env
PORT=3000
DATABASE_URL=postgresql://feeduser:feedpass@localhost:5432/feeddb
REDIS_URL=redis://localhost:6379
```

### 3. Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: feeduser
      POSTGRES_PASSWORD: feedpass
      POSTGRES_DB: feeddb
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./sql/schema.sql:/docker-entrypoint-initdb.d/schema.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    # MAJOR FIX: Changed from allkeys-lru to noeviction. Feed data must never
    # be silently evicted — if memory is full, Redis should return errors so
    # we can scale horizontally, not drop users' entire feed history silently.
    command: redis-server --maxmemory 256mb --maxmemory-policy noeviction

  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://feeduser:feedpass@postgres:5432/feeddb
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  pgdata:
```

### 4. Database Schema

```sql
-- sql/schema.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- MAJOR FIX: Removed follower_count/following_count cached columns.
-- Keeping these in sync requires atomic updates across two rows on every
-- follow/unfollow. At scale they drift and require periodic recalculation.
-- Use COUNT(*) on read, or compute in Redis with background sync.

CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, target_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (LENGTH(content) <= 280),
  parent_id UUID REFERENCES posts(id) ON DELETE CASCADE, -- for replies
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);
-- MAJOR FIX: Removed like_count/retweet_count/reply_count from posts table.
-- Viral posts create row-level lock contention when thousands of concurrent
-- likes update the same row. We use Redis counters for real-time counts and
-- sync to a separate post_stats table in the background.

-- Initial partitions
CREATE TABLE IF NOT EXISTS posts_2025_05 PARTITION OF posts
  FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS posts_2025_06 PARTITION OF posts
  FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_id) WHERE parent_id IS NOT NULL;
-- MAJOR FIX: Index on follows(target_id) is required for efficient fan-out.
-- Without it, PostgreSQL must sequential-scan the follows table to find
-- all followers of a given user, which is O(n) per post at scale.
CREATE INDEX IF NOT EXISTS idx_follows_target ON follows(target_id);

CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS retweets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  comment TEXT CHECK (comment IS NULL OR LENGTH(comment) <= 280),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- For "people you follow liked this"
CREATE TABLE IF NOT EXISTS user_post_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  engagement_type VARCHAR(10) NOT NULL CHECK (engagement_type IN ('like', 'retweet')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id, engagement_type)
);

-- MAJOR FIX: Separate stats table avoids row-level lock contention on the
-- main posts table. Background workers sync Redis counters here in bulk.
CREATE TABLE IF NOT EXISTS post_stats (
  post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  like_count INTEGER NOT NULL DEFAULT 0,
  retweet_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to auto-create monthly partitions
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
  next_month TEXT;
  next_month_end TEXT;
BEGIN
  next_month := to_char(date_trunc('month', now()) + interval '2 months', 'YYYY_MM');
  next_month_end := to_char(date_trunc('month', now()) + interval '3 months', 'YYYY-MM-DD');
  
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS posts_%s PARTITION OF posts FOR VALUES FROM (%L) TO (%L)',
    next_month, 
    date_trunc('month', now()) + interval '2 months',
    next_month_end
  );
END;
$$ LANGUAGE plpgsql;
```

### 5. Database and Redis Clients

```typescript
// src/config/database.ts
import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error', err);
  process.exit(-1);
});
```

```typescript
// src/config/redis.ts
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('error', (err) => {
  console.error('Redis error', err);
});
```

```typescript
// src/types/index.ts
export interface Post {
  id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  created_at: Date;
}

export interface FeedCursor {
  score: number;
  id: string;
}
```

### 6. Ranking Service

```typescript
// src/services/ranking.ts
export function calculateFeedScore(
  likeCount: number,
  retweetCount: number,
  replyCount: number,
  createdAt: Date,
  gravity = 1.8
): number {
  const engagementScore = likeCount + retweetCount * 2 + replyCount * 3;
  const hoursSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  const denominator = Math.pow(hoursSince + 2, gravity);
  return engagementScore / denominator;
}

// Composite score for Redis: high bits = time, low bits = ranking
// This ensures newer posts generally rank higher unless engagement is massive
export function composeRedisScore(score: number, createdAt: Date): number {
  const timeComponent = createdAt.getTime();
  // MAJOR FIX: Explicitly guard against exceeding Number.MAX_SAFE_INTEGER
  // (9,007,199,254,740,991). timeComponent is ~1.7e12; *1000 = ~1.7e15,
  // which is safe today, but silent integer overflow would corrupt Redis
  // sorted-set ordering and cause posts to appear in the wrong positions.
  if (timeComponent > Number.MAX_SAFE_INTEGER / 1000) {
    throw new Error('Time component too large for safe composite score');
  }
  const normalizedScore = Math.min(999, Math.floor(score * 10));
  return timeComponent * 1000 + normalizedScore;
}
```

### 7. Fan-out Service

```typescript
// src/services/fanout.ts
import { pool } from '../config/database.js';
import { redis } from '../config/redis.js';
import { calculateFeedScore, composeRedisScore } from './ranking.js';

export const CELEBRITY_THRESHOLD = 100_000;

export async function fanOutPost(postId: string, authorId: string): Promise<void> {
  const client = await pool.connect();
  try {
    // MAJOR FIX: Compute follower count on demand instead of using a cached
    // column that can drift. The cached column required atomic updates across
    // two rows on every follow/unfollow, creating a cache invalidation bomb.
    const { rows } = await client.query(
      'SELECT COUNT(*) FROM follows WHERE target_id = $1',
      [authorId]
    );
    const followerCount = parseInt(rows[0].count, 10);

    // Celebrity: store in celebrity index, don't fan out
    if (followerCount > CELEBRITY_THRESHOLD) {
      const score = composeRedisScore(0, new Date());
      await redis.zadd(`celebrity:posts:${authorId}`, score, postId);
      return;
    }

    // Get followers
    const followers = await client.query(
      'SELECT follower_id FROM follows WHERE target_id = $1',
      [authorId]
    );

    if (followers.rows.length === 0) return;

    // Compute score
    const score = composeRedisScore(0, new Date());

    // Pipeline to all followers
    const pipeline = redis.pipeline();
    for (const row of followers.rows) {
      pipeline.zadd(`feed:${row.follower_id}`, score, postId);
      pipeline.zremrangebyrank(`feed:${row.follower_id}`, 0, -5001);
    }
    await pipeline.exec();
  } finally {
    client.release();
  }
}
```

### 8. Feed Service

```typescript
// src/services/feed.ts
import { pool } from '../config/database.js';
import { redis } from '../config/redis.js';
import { CELEBRITY_THRESHOLD } from './fanout.js';
import type { Post, FeedCursor } from '../types/index.js';

export async function getFeed(
  userId: string,
  cursor?: string,
  limit = 20
): Promise<{ posts: Post[]; nextCursor?: string }> {
  // MAJOR FIX: Malformed cursors must return 400 Bad Request, not 500.
  // Buffer.from accepts invalid base64; JSON.parse then throws and bubbles
  // up as an unhandled internal server error, leaking stack traces.
  let minScore = '-inf';
  if (cursor) {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString()) as FeedCursor;
      minScore = `(${parsed.score}`;
    } catch {
      const err = new Error('Invalid cursor');
      (err as any).statusCode = 400;
      throw err;
    }
  }

  // 1. Get celebrity IDs user follows
  // MAJOR FIX: Removed JOIN on users.follower_count (column removed to avoid
  // cache invalidation issues). Use a subquery to find users with > threshold
  // followers, which is always accurate.
  const { rows: celebRows } = await pool.query(
    `SELECT f.target_id
     FROM follows f
     WHERE f.follower_id = $1
       AND f.target_id IN (
         SELECT target_id FROM follows
         GROUP BY target_id
         HAVING COUNT(*) > $2
       )`,
    [userId, CELEBRITY_THRESHOLD]
  );
  const celebIds = celebRows.map(r => r.target_id as string);

  // 2. Fetch normal feed WITH scores so we can sort correctly
  const normalFeed = await redis.zrevrangebyscore(
    `feed:${userId}`,
    '+inf',
    minScore,
    'WITHSCORES',
    'LIMIT',
    0,
    limit
  );

  // 3. Fetch celebrity posts WITH scores
  let celebPosts: string[] = [];
  if (celebIds.length > 0) {
    const pipeline = redis.pipeline();
    for (const cid of celebIds) {
      pipeline.zrevrangebyscore(`celebrity:posts:${cid}`, '+inf', minScore, 'WITHSCORES', 'LIMIT', 0, limit);
    }
    const results = await pipeline.exec();
    celebPosts = results
      ?.flatMap(r => (r[0] ? [] : (r[1] as string[])))
      ?? [];
  }

  // CRITICAL FIX: Merge by Redis score, not insertion order.
  // `const allIds = [...new Set([...normalFeedIds, ...celebPostIds])]` destroys
  // the score-based ranking because Set preserves insertion order, not time.
  // A high-score celebrity post could appear AFTER a low-score normal post.
  const entries: { id: string; score: number }[] = [];
  for (let i = 0; i < normalFeed.length; i += 2) {
    entries.push({ id: normalFeed[i], score: parseFloat(normalFeed[i + 1]) });
  }
  for (let i = 0; i < celebPosts.length; i += 2) {
    entries.push({ id: celebPosts[i], score: parseFloat(celebPosts[i + 1]) });
  }
  entries.sort((a, b) => b.score - a.score);

  // Deduplicate while preserving score order
  const seen = new Set<string>();
  const sortedIds: string[] = [];
  const sortedScores: number[] = [];
  for (const e of entries) {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      sortedIds.push(e.id);
      sortedScores.push(e.score);
      if (sortedIds.length === limit) break;
    }
  }

  if (sortedIds.length === 0) return { posts: [] };

  // MAJOR FIX: Limit the ID array before querying PostgreSQL.
  // An unbounded ANY array forces PostgreSQL to sort all matching rows
  // before applying LIMIT, which is O(n log n) and wasteful.
  const { rows: posts } = await pool.query<Post>(
    `SELECT * FROM posts WHERE id = ANY($1::uuid[]) ORDER BY created_at DESC LIMIT $2`,
    [sortedIds, limit]
  );

  // CRITICAL FIX: Handle null scores for celebrity posts.
  // If lastPost came from the celebrity merge, redis.zscore on the user's
  // feed returns null. The cursor becomes { score: NaN }, breaking pagination.
  // We use the score we already fetched during the merge.
  let nextCursor: string | undefined;
  if (posts.length === limit && sortedScores.length >= limit) {
    const lastId = sortedIds[sortedIds.length - 1];
    const lastScore = sortedScores[sortedScores.length - 1];
    const cursorObj: FeedCursor = { score: lastScore, id: lastId };
    nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64');
  }

  return { posts, nextCursor };
}
```

### 9. Routes

```typescript
// src/routes/posts.ts
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { fanOutPost } from '../services/fanout.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

const createPostSchema = z.object({
  user_id: z.string().uuid(),
  content: z.string().max(280),
  parent_id: z.string().uuid().optional(),
});

// INTENTIONAL BUG #1: Fan-out is synchronous and blocking
// See Section 5 for the fix
// MAJOR FIX: Apply rate limiting to post creation. Without it, a single
// bot can create 1,000 posts/second, causing 500,000 Redis writes/second
// during fan-out and melting the Redis cluster.
router.post('/', rateLimit('create_post', 60_000, 10), async (req, res, next) => {
  try {
    const data = createPostSchema.parse(req.body);
    
    const { rows } = await pool.query(
      `INSERT INTO posts (user_id, content, parent_id) 
       VALUES ($1, $2, $3) RETURNING *`,
      [data.user_id, data.content, data.parent_id || null]
    );
    const post = rows[0];

    // BUG: This blocks the response for celebrities!
    await fanOutPost(post.id, post.user_id);

    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});

export default router;
```

```typescript
// src/routes/feed.ts
import { Router } from 'express';
import { z } from 'zod';
import { getFeed } from '../services/feed.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

// MAJOR FIX: Apply rate limiting to feed reads. Without it, a scraper can
// enumerate every user's feed infinitely, exhausting Redis and PostgreSQL.
router.get('/:userId', rateLimit('feed_read', 60_000, 100), async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const result = await getFeed(userId, cursor, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
```

```typescript
// src/routes/engagement.ts
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { redis } from '../config/redis.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

// Like a post
// MAJOR FIX: Rate limit engagement endpoints to prevent like-bombing bots.
router.post('/likes', rateLimit('like', 60_000, 60), async (req, res, next) => {
  try {
    const schema = z.object({
      user_id: z.string().uuid(),
      post_id: z.string().uuid(),
    });
    const { user_id, post_id } = schema.parse(req.body);

    // CRITICAL FIX: Use a single dedicated client for the transaction.
    // pool.query('BEGIN') acquires a RANDOM connection from the pool. Each
    // subsequent pool.query() may run on a DIFFERENT connection. The BEGIN,
    // INSERT, UPDATE, and COMMIT could execute on four separate sessions,
    // providing ZERO atomicity. Under load this causes race conditions,
    // deadlocks, and permanent data corruption.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [user_id, post_id]
      );

      // MAJOR FIX: We avoid row-level lock contention by NOT storing counts in
      // the posts table. Instead we increment a Redis counter and let a
      // background worker sync to the post_stats table periodically.
      await redis.incr(`post:likes:${post_id}`);

      // Track for "people you follow liked this"
      await client.query(
        `INSERT INTO user_post_engagements (user_id, post_id, engagement_type)
         VALUES ($1, $2, 'like') ON CONFLICT DO NOTHING`,
        [user_id, post_id]
      );

      await client.query('COMMIT');
      res.status(201).json({ liked: true });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      next(err);
    } finally {
      client.release();
    }
});

// Get "people you follow liked this"
// CRITICAL FIX: Added authentication middleware check. Without authorization,
// any authenticated user could query social proof for ANY other user by
// changing the URL parameter, leaking private follow/like relationships.
router.get('/social-proof/:userId/:postId', authenticateUser, async (req, res, next) => {
  try {
    const { userId, postId } = req.params;

    if (req.user!.id !== userId) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    
    const { rows } = await pool.query(
      `SELECT u.username, u.display_name
       FROM user_post_engagements e
       JOIN follows f ON e.user_id = f.target_id
       JOIN users u ON e.user_id = u.id
       WHERE f.follower_id = $1
         AND e.post_id = $2
         AND e.engagement_type = 'like'
       LIMIT 5`,
      [userId, postId]
    );

    res.json({
      count: rows.length,
      users: rows,
    });
  } catch (err) {
    next(err);
  }
});

// Retweet
router.post('/retweets', rateLimit('retweet', 60_000, 30), async (req, res, next) => {
  try {
    const schema = z.object({
      user_id: z.string().uuid(),
      post_id: z.string().uuid(),
      comment: z.string().max(280).optional(),
    });
    const { user_id, post_id, comment } = schema.parse(req.body);

    // CRITICAL FIX: All three writes must be atomic. If the server crashes
    // between the INSERT and the engagement tracking, the database becomes
    // inconsistent (retweet exists but social-proof data is missing).
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'INSERT INTO retweets (user_id, post_id, comment) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [user_id, post_id, comment || null]
      );

      await redis.incr(`post:retweets:${post_id}`);

      await client.query(
        `INSERT INTO user_post_engagements (user_id, post_id, engagement_type)
         VALUES ($1, $2, 'retweet') ON CONFLICT DO NOTHING`,
        [user_id, post_id]
      );

      await client.query('COMMIT');
      res.status(201).json({ retweeted: true });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

export default router;
```

### 10. Main Application

```typescript
// src/index.ts
import 'dotenv/config';
import express from 'express';
import postsRouter from './routes/posts.js';
import feedRouter from './routes/feed.js';
import engagementRouter from './routes/engagement.js';

const app = express();
app.use(express.json());

app.use('/posts', postsRouter);
app.use('/feed', feedRouter);
app.use('/engagement', engagementRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Feed engine running on port ${PORT}`);
});
```

### Running the Project

```bash
# Terminal 1: Start infrastructure
docker-compose up postgres redis

# Terminal 2: Run migrations and start app
pnpm db:migrate
pnpm dev

# Test: Create a user, follow someone, create a post, fetch feed
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"user_id":"YOUR_USER_ID","content":"Hello world!"}'

curl "http://localhost:3000/feed/YOUR_USER_ID?limit=20"
```

---

## Section 5: 5 Intentional Bugs

### Bug 1: Synchronous Fan-out Blocks Post Creation

**How to introduce:** Call `fanOutPost()` directly inside the POST /posts handler and `await` it before sending the response.

**Symptoms:**
- Creating a post as a user with 1M followers takes 30+ seconds.
- API Gateway times out at 30s.
- Celebrity users can't post. They tweet "your app is broken."

**Reproduction:**
```bash
# Seed a user with 1M followers
# POST /posts -> hangs for 30s, then 504 Gateway Timeout
```

**Fix:** Move fan-out to an async background job/queue.

```typescript
// FIXED: src/routes/posts.ts
router.post('/', async (req, res, next) => {
  try {
    const data = createPostSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO posts (user_id, content) VALUES ($1, $2) RETURNING *`,
      [data.user_id, data.content]
    );
    const post = rows[0];

    // CRITICAL FIX: Never use setImmediate for critical background work.
    // It schedules work on the event loop with ZERO persistence, retry, or
    // crash recovery. If the Node.js process receives SIGKILL before the
    // callback executes, the fan-out is lost FOREVER. The post exists but
    // reaches zero followers. Use BullMQ (Redis-backed) so jobs survive
    // process restarts and are retried on failure.
    // In production: import { Queue } from 'bullmq';
    // const postQueue = new Queue('fan-out', { connection: redis });
    await postQueue.add('fan-out', { postId: post.id, authorId: post.user_id });

    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
});
```

**WHY:** HTTP requests should complete in < 200ms. Fan-out is an eventually-consistent side effect. By making it async, we decouple the user-facing write from the background propagation. The user sees their post immediately; followers see it within seconds.

---

### Bug 2: Offset Pagination Causes Duplicates and Missing Posts

**How to introduce:** Use `LIMIT 20 OFFSET $page * 20` in the feed query.

**Symptoms:**
- User scrolls page 1 (posts 1-20).
- 5 new posts arrive.
- User scrolls page 2 (OFFSET 20). Posts 15-19 from page 1 reappear.
- Posts 20-24 are skipped entirely.

**Reproduction:**
```bash
# Load feed page 1
# Another user creates 3 posts
# Load feed page 2 -> duplicates!
```

**Fix:** Use cursor pagination based on an absolute boundary.

```typescript
// FIXED: Already implemented in getFeed service above.
// Key concepts:
// 1. Encode (score, id) as base64 cursor
// 2. Query for items with score < previous_min_score
// 3. New insertions have higher scores, so they don't affect the cursor boundary
```

**WHY:** Offset is a logical position (`skip N rows`). If rows are inserted at the top, everything shifts down. Cursor is a physical boundary (`give me rows before this exact score`). Insertions at the top don't affect "before X" queries.

---

### Bug 3: No Rate Limiting on Post Creation

**How to introduce:** Allow unlimited POST /posts requests.

**Symptoms:**
- Bot creates 1,000 posts/second.
- Each post fans out to 500 followers = 500,000 Redis writes/second.
- Redis CPU hits 100%. Feed reads timeout. System dies.

**Reproduction:**
```bash
# Run a script that hammers POST /posts
while true; do curl -X POST http://localhost:3000/posts ...; done &
# Spawn 50 of these. Watch Redis `INFO stats`.
```

**Fix:** Add rate limiting.

```typescript
// src/middleware/rateLimit.ts
import { redis } from '../config/redis.js';
import type { Request, Response, NextFunction } from 'express';

export function rateLimit(
  keyPrefix: string,
  windowMs: number,
  maxRequests: number
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `ratelimit:${keyPrefix}:${req.ip}`;
    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.pexpire(key, windowMs);
      }
      if (current > maxRequests) {
        res.status(429).json({ error: 'Too many requests' });
        return;
      }
      next();
    } catch (err) {
      // CRITICAL FIX: If Redis is down, the rate limiter must fail gracefully.
      // An unhandled exception here returns 500 and exposes internal state.
      // "Fail open" allows the request through to avoid a total outage;
      // "Fail closed" (return 503) is safer but breaks all traffic.
      console.error('Rate limiter Redis error:', err);
      next();
    }
  };
}

// In posts router:
// router.post('/', rateLimit('create_post', 60_000, 10), async (req, res) => { ... })
```

**WHY:** Rate limiting is your first line of defense against abuse. Without it, a single bad actor can generate more write load than your entire legitimate user base. Fan-out amplifies every write by the follower count, making rate limiting exponentially more important.

---

### Bug 4: Race Condition in Like Count

**How to introduce:** Read `like_count`, increment in JS, then UPDATE.

```typescript
// BROKEN:
const { rows } = await pool.query('SELECT like_count FROM posts WHERE id = $1', [postId]);
const newCount = rows[0].like_count + 1;
await pool.query('UPDATE posts SET like_count = $1 WHERE id = $2', [newCount, postId]);
```

**Symptoms:**
- Two users like simultaneously.
- Both read `like_count = 5`.
- Both write `6`.
- Final count is `6`. Should be `7`.
- On viral posts, you lose thousands of likes.

**Reproduction:**
```bash
# Fire two like requests simultaneously
 curl ... & curl ... & wait
# Check like_count: it incremented by 1 instead of 2
```

**Fix:** Avoid storing counts in the post row entirely.

```typescript
// FIXED: src/routes/engagement.ts (like handler)
// MAJOR FIX: We avoid this race condition AND row-level lock contention
// entirely by NOT storing like_count in the posts table. Viral posts with
// 10,000 concurrent likes would serialize on a single row lock, grinding
// the database to a halt. Instead we use Redis counters for real-time
// counts and sync to a separate post_stats table in the background.
await redis.incr(`post:likes:${post_id}`);
// Background worker periodically:
// INSERT INTO post_stats (post_id, like_count) VALUES ($1, $2)
// ON CONFLICT (post_id) DO UPDATE SET like_count = EXCLUDED.like_count
```

**WHY:** Database `UPDATE ... = ... + 1` is atomic at the row level and fixes the race condition. However, on viral posts, thousands of concurrent transactions serialize on the same row lock, turning 10k QPS into 100 QPS. The project avoids both problems by using Redis counters and a background sync worker.

---

### Bug 5: Hot Partition on Posts Table

**How to introduce:** Single `posts` table with no partitioning. All INSERTs hit the same index leaf pages.

**Symptoms:**
- Write throughput plateaus at ~5,000 INSERTs/second.
- `INSERT INTO posts` latency spikes to 500ms during peak hours.
- PostgreSQL `waits` show heavy `LWLock:WalWrite` and `BufferContent` contention.
- You can't scale by adding read replicas because the bottleneck is writes.

**Reproduction:**
```bash
# Run a load test:
# pgbench -f insert_post.sql -c 50 -j 10 -T 60
# Watch throughput plateau while CPU is not saturated
```

**Fix:** Time-based partitioning (already in schema above).

```sql
-- Already implemented in schema.sql
-- PostgreSQL routes INSERTs to the correct partition based on created_at
-- Each partition has its own indexes, spreading the write load
```

**WHY:** Time-series data has a natural partition key. Today's writes go to this month's partition. Next month's writes go to a fresh, empty partition. This prevents the B-tree index from growing into a single, globally-contended structure. Instagram, Twitter, and Discord all partition by time or snowflake ID for this exact reason.

---

## Section 6: Scaling Considerations

### How Twitter Actually Works (Simplified)

Twitter uses a **multi-layer hybrid approach**:
1. **Home timeline service:** Each user has a Redis cluster storing their pre-computed feed (the "timeline").
2. **Social graph service:** Stores follow relationships.
3. **Tweet service:** Stores tweet content.
4. **Fan-out service:** Pushes tweet IDs to followers' timelines. For celebrities, it bypasses this.
5. **Merge service:** When you load your feed, it merges your pre-computed timeline with real-time tweets from celebrities you follow.
6. **Search/indexing:** Elasticsearch for search, not for feeds.

Key insight: Twitter's feed is not a real-time query. It's a pre-materialized data structure that gets merged with a small amount of real-time data on read.

### Read Replicas for Feed Reads

As you scale, direct PostgreSQL queries for post metadata can become a bottleneck. Add read replicas:

```typescript
// src/config/database.ts
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ...
});

export const readPool = new Pool({
  connectionString: process.env.READ_DATABASE_URL || process.env.DATABASE_URL,
  // ...
});

// Use readPool for feed post metadata lookups
// Use pool for writes (likes, posts, follows)
```

**Trade-off:** Replication lag. A user might post and not see it in their own feed for 100ms. This is acceptable for social media.

### CDN for Media

Never serve images/video from your API. Store media in S3/R2 and serve via CloudFront/Cloudflare:

```typescript
// Store only the URL in PostgreSQL
// { media_url: "https://cdn.yourapp.com/media/abc123.jpg" }
```

### Caching Strategies

1. **Feed cache:** Redis sorted sets (primary storage, not just cache).
2. **User cache:** Redis hash for user profiles (`HGETALL user:1234`).
3. **Post cache:** Redis string with TTL for hot posts (`GET post:1234` as JSON).
4. **Social proof cache:** Cache "people you follow liked this" for 30 seconds.

```typescript
// Post cache example
async function getPostById(id: string): Promise<Post> {
  const cached = await redis.get(`post:${id}`);
  if (cached) return JSON.parse(cached);
  
  const { rows } = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
  const post = rows[0];
  await redis.setex(`post:${id}`, 300, JSON.stringify(post));
  return post;
}
```

### Redis Memory Considerations

Each feed entry is: ~16 bytes (score) + ~36 bytes (post ID as string) + Redis overhead (~50 bytes) ≈ **100 bytes per entry**.

For 10M users with 5,000 feed entries each: 10M × 5,000 × 100 bytes = **5TB of Redis**.

**You can't store everything in Redis.** Strategies:
1. **Trim feeds:** Keep only the last 5,000 entries per user. Older posts fall back to on-demand query.
2. **Active users only:** Store Redis feeds only for users who logged in within 30 days. Rebuild from PostgreSQL on login for dormant users.
3. **Shard by user ID:** `feed:1234` goes to Redis shard `hash(1234) % 64`.
4. **Memory policy:** Use `noeviction` for feed storage (never silently drop feeds). Add explicit TTLs on non-critical keys and use `volatile-lru` for those.

**MAJOR FIX: Deleted Post Cleanup.** If a user deletes a post, the post ID remains in every follower's Redis feed. The `getFeed` query filters out deleted posts in PostgreSQL, but the IDs still occupy slots in the Redis sorted set, causing pages to return fewer results than expected. Implement a background cleaner that subscribes to post deletion events and removes the post ID from all affected feed keys, or use a soft-delete pattern with periodic compaction.

---

## Section 7: Deployment

### Dockerfile

```dockerfile
FROM node:22-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Full docker-compose.yml

(See Section 4, Step 2 for the full file.)

### Running in Production Mode

```bash
# Build and start everything
docker-compose up --build

# Scale the app layer (if using Docker Swarm or Compose replicas)
docker-compose up --scale app=3

# Monitor Redis memory
redis-cli INFO memory

# Monitor PostgreSQL connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

### Environment Checklist

- [ ] `DATABASE_URL` points to a managed PostgreSQL with read replicas
- [ ] `REDIS_URL` points to Redis Cluster (not single instance) for feed storage
- [ ] Redis has `maxmemory-policy allkeys-lru` and `maxmemory` set appropriately
- [ ] Post creation is rate-limited at the edge (CDN/WAF) and app layer
- [ ] Background fan-out workers run on separate containers from API servers
- [ ] Health check endpoint exists for load balancer
- [ ] Logging aggregation (Datadog, Grafana) is configured
- [ ] Alerts on Redis memory usage > 80% and PostgreSQL connection pool saturation

---

## Section 8: Post-Mortem Template

When something breaks (and it will), use this template to learn.

```markdown
# Post-Mortem: [Incident Title]

## Date
YYYY-MM-DD

## Summary
One-sentence description of what happened.

## Impact
- **Duration:** XX minutes
- **Users affected:** X% of DAU
- **Severity:** P0 / P1 / P2

## Timeline
- HH:MM - First alert fired (metric/link)
- HH:MM - On-call engineer acknowledged
- HH:MM - Root cause identified
- HH:MM - Mitigation deployed
- HH:MM - Service fully recovered

## Root Cause
What technical failure caused this?

## Trigger
What specific event triggered the failure?
(e.g., "Celebrity @elonmusk posted, causing 100M fan-out writes to Redis")

## Resolution
What fixed it? Include code snippets or config changes.

## Prevention
- What monitoring/alerting should have caught this earlier?
- What code/architecture changes prevent recurrence?
- What runbook should be updated?

## Lessons Learned
What did the team learn?

## Action Items
| Action | Owner | Due Date |
|--------|-------|----------|
| Fix async fan-out queue | @engineer | YYYY-MM-DD |
| Add Redis memory alert | @sre | YYYY-MM-DD |
```

---

## Summary

This project teaches one of the hardest problems in backend engineering: **building a scalable social feed**.

You learned:
- **Hybrid fan-out:** Push for normal users, pull for celebrities. This prevents both slow reads and write avalanches.
- **Redis sorted sets:** The perfect data structure for pre-computed, scored, paginated feeds.
- **Cursor pagination:** The only correct way to paginate real-time feeds without duplicates or gaps.
- **Atomic operations:** Why `UPDATE count = count + 1` matters and why read-modify-write is a trap.
- **Time-based partitioning:** How to prevent hot partitions from throttling write throughput.
- **Async processing:** Why HTTP requests must never wait for fan-out, and why queues save your API.

The complete code above is runnable, but it's a starting point. Real production systems add:
- Background job queues (BullMQ, RabbitMQ, SQS)
- Redis Cluster for horizontal scaling
- Read replicas and connection pooling
- Rate limiting at every layer
- Feature flags to disable fan-out during incidents

**Build it. Break it. Fix it. Scale it.**
