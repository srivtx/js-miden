# MD09 Social Feed Engine — v7 Production Setup

> **Motto**: Fan out fast, cache faster.

## What Changed

This is the full production-grade social feed engine:
- **Fan-out** — push model for normal users, pull model for celebrities
- **Ranking** — score posts by recency + engagement (likes, retweets)
- **Cursor pagination** — `postId:timestamp` cursors, no duplicates
- **Caching** — Redis sorted sets for feeds, with TTL and invalidation

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│   Express       │─────▶│  PostgreSQL     │
│  (Reader)   │◀─────│   API           │◀─────│  (Users, Posts) │
└─────────────┘      └─────────────────┘      └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │    Redis     │
                       │  (Feeds,     │
                       │   Cursors)   │
                       └──────────────┘
```

## Code

### Fan-Out

```typescript
// src/routes/posts.ts
function fanOutPost(post: Post) {
  const author = users.get(post.authorId);
  if (!author) return;

  // Push model for normal users
  if (author.followerCount < 1_000_000) {
    const followers = getFollowers(post.authorId);
    for (const followerId of followers) {
      const feed = userFeeds.get(followerId) || [];
      feed.unshift(post.id);
      userFeeds.set(followerId, feed);
    }
  }
  // Celebrities use pull model (no push)
}

router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const { content } = req.body;
  const authorId = req.userId!;
  const id = crypto.randomUUID();
  const post: Post = {
    id,
    authorId,
    content,
    likes: 0,
    retweets: 0,
    createdAt: new Date(),
  };
  posts.set(id, post);

  // BUG (v1): Synchronous fan-out blocks post creation
  // FIX (v7): Move to background job or Redis pipeline
  fanOutPost(post);

  res.status(201).json(post);
});
```

### Ranking

```typescript
// src/services/ranking.ts
export function scorePost(post: Post): number {
  const now = Date.now();
  const ageHours = (now - post.createdAt.getTime()) / (1000 * 60 * 60);
  const engagement = post.likes * 2 + post.retweets * 3;
  // Recency decays, engagement boosts
  return (1000 / (ageHours + 1)) + engagement;
}

// src/routes/posts.ts
app.get('/feed', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const feed = userFeeds.get(userId) || [];

  const ranked = feed
    .map(id => posts.get(id))
    .filter(Boolean)
    .sort((a, b) => scorePost(b!) - scorePost(a!));

  res.json({ posts: ranked.slice(0, 20) });
});
```

### Cursor Pagination

```typescript
// src/routes/posts.ts
app.get('/feed', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

  const feed = userFeeds.get(userId) || [];
  let startIndex = 0;

  if (cursor) {
    const [cursorId, cursorTime] = cursor.split(':');
    startIndex = feed.findIndex(id => {
      const post = posts.get(id);
      return post && post.id === cursorId && post.createdAt.getTime() === parseInt(cursorTime);
    }) + 1;
  }

  const paginated = feed.slice(startIndex, startIndex + limit);
  const result = paginated.map(id => posts.get(id)).filter(Boolean);

  const lastPost = result[result.length - 1];
  const nextCursor = lastPost ? `${lastPost.id}:${lastPost.createdAt.getTime()}` : null;

  res.json({
    posts: result,
    nextCursor,
    limit,
  });
});
```

### Caching

```typescript
// src/services/cache.ts
import Redis from 'ioredis';

const redis = new Redis();
const FEED_TTL_SECONDS = 300;

export async function getCachedFeed(userId: string, cursor?: string, limit: number = 20) {
  const key = `feed:${userId}`;
  const feedIds = await redis.zrevrange(key, 0, limit - 1);
  if (feedIds.length === 0) return null;

  const posts = await Promise.all(feedIds.map(id => getPostById(id)));
  return posts.filter(Boolean);
}

export async function cachePostForUser(userId: string, postId: string, score: number) {
  const key = `feed:${userId}`;
  await redis.zadd(key, score, postId);
  await redis.expire(key, FEED_TTL_SECONDS);
}
```

## Decisions

**Fan-out: push vs pull vs hybrid**
- Option A: Push — write to every follower's feed on post creation
- Option B: Pull — fetch posts on read
- Option C: Hybrid — push for normal users, pull for celebrities
- **Chosen: C** — normal users have < 10k followers (push is fast); celebrities have > 1M (pull avoids write amplification)

**Pagination: cursor vs offset**
- Option A: Offset — `?offset=20&limit=20`
- Option B: Cursor — `?cursor=postId:timestamp`
- **Chosen: B** — no duplicates when new posts arrive, consistent performance

## Checklist

- [ ] Fan-out uses push for normal users and pull for celebrities (> 1M followers)
- [ ] Feed is ranked by recency + engagement
- [ ] Pagination uses cursor-based navigation
- [ ] Redis caches feeds with a 5-minute TTL
- [ ] Cache is invalidated on new post, like, or retweet
- [ ] All async operations have structured logging with `requestId`

## Post-Mortem: v7 Bugs

1. **Synchronous fan-out blocks post creation** (fixed): Moved to background job or Redis pipeline
2. **Offset pagination causes duplicates** (fixed): Switched to cursor pagination
3. **No caching** (fixed): Redis sorted sets with TTL

## Your Turn

- What happens if a celebrity with 10M followers posts?
- How would you implement real-time updates (WebSockets vs SSE vs polling)?
- Should the ranking algorithm be configurable per user?
