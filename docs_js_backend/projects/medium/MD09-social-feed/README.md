# MD09: Social Feed Engine

Twitter-like social feed with fan-out, cursor pagination, and Redis sorted sets.

## Quick Start

```bash
docker-compose up -d
npm install
npm run dev
```

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/auth/register | POST | Create user |
| /api/auth/login | POST | Get JWT token |
| /api/posts | POST | Create post |
| /api/posts/feed | GET | Get feed (cursor pagination) |
| /api/posts/:id/like | POST | Like post |
| /api/posts/:id/retweet | POST | Retweet post |
| /api/users/:id/follow | POST | Follow user |

## Architecture

- **Fan-out**: Push model for normal users, pull model for celebrities (>1M followers)
- **Feed Storage**: Redis sorted sets (score = timestamp)
- **Pagination**: Cursor-based using post ID + timestamp
- **Rate Limiting**: Redis sliding window per user

## Known Issues (for debugging practice)

1. **BUG**: Fan-out is synchronous and blocks post creation for large follower counts
2. **BUG**: Offset pagination causes duplicates when new posts arrive during scrolling

## Documentation

See `/docs` for full architecture, API reference, and troubleshooting guides.

## Testing

```bash
npm test
```

Tests include failing tests that reproduce the known bugs.
