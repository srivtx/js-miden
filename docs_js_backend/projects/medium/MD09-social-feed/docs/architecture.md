# Architecture

## Overview

The Social Feed Engine is a Twitter-like platform with a focus on feed distribution performance and real-time interactions.

## Components

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Express   │────▶│  PostgreSQL  │
│             │◀────│   API       │◀────│  (Users,    │
└─────────────┘     └─────────────┘     │  Posts)      │
        │               │               └─────────────┘
        │               │
        │               ▼
        │          ┌─────────────┐
        │          │    Redis    │
        │          │  (Feeds,    │
        │          │  Cursors)   │
        │          └─────────────┘
        │               │
        └───────────────┘
              WebSocket
```

## Feed Distribution (Fan-out)

### Push Model (Normal Users)
- When a user posts, push post ID to all followers' Redis sorted sets
- Score = timestamp for chronological ordering
- Read feed = ZREVRANGE on user's feed key

### Pull Model (Celebrities)
- Users with >1M followers use pull model
- Followers' feeds store only normal users
- Celebrity posts fetched on-demand and merged

### Hybrid Approach
- Celebrity threshold: 1,000,000 followers
- Normal users: push to all followers (~100ms for 10k followers)
- Celebrities: followers poll their recent posts

## Pagination

### Cursor-Based (Recommended)
- Cursor = `postId:timestamp`
- No duplicates when new posts arrive
- Consistent performance regardless of offset

### Offset-Based (Current Bug)
- `?offset=20&limit=20`
- Duplicates when new posts arrive during scroll
- Performance degrades with large offsets

## Data Flow

1. User creates post → API receives request
2. Post stored in PostgreSQL
3. Fan-out service pushes to followers' Redis feeds
4. Clients poll `/api/posts/feed?cursor=...` for updates
