# MD09 Social Feed Engine — v4 Add Logging

> **Motto**: Log every scroll.

## What Changed

Replaced `console.log` with `pino` structured JSON logging. Every feed request gets a `requestId`. Posts log creation, likes, and retweets. Added correlation IDs across async boundaries.

## Why

- **Analytics**: Product needs to know feed load times and engagement rates
- **Debugging**: A user says "my post disappeared" — search by `requestId` to see the exact flow
- **Alerting**: Log-based metrics (`feed.error` > 5/min) trigger PagerDuty

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│   Express       │─────▶│  In-Memory      │
│  (Reader)   │      │  + pino logger  │      │  Maps           │
└─────────────┘      └────────┬────────┘      └─────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  stdout /    │
                       │  log shipper │
                       └──────────────┘
```

## Code

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'social-feed' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// src/routes/posts.ts
import { logger } from '../utils/logger.js';

app.get('/feed', (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const log = logger.child({ requestId, route: 'GET /feed' });

  const start = Date.now();
  const allPosts = Array.from(posts.values());
  allPosts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  log.info({ count: allPosts.length, durationMs: Date.now() - start }, 'Feed generated');
  res.json({ posts: allPosts, total: allPosts.length });
});

app.post('/posts', validateBody(postSchema), (req: Request, res: Response) => {
  const { content, authorId } = req.body;
  logger.info({ authorId, contentLength: content.length }, 'Post created');
  // ...
});
```

## Decisions

**Option A: Winston**
- Pros: Transports, formatting
- Cons: Slower, heavier config

**Option B: Pino**
- Pros: Fast, structured by default, ESM-friendly
- Cons: Fewer built-in transports

**Chosen: Pino** — we ship logs to stdout and let the platform handle aggregation.

## Problems We Accepted

- Logs are stdout-only; no log aggregation configured yet
- No automatic redaction of user-generated content
- Feed generation is still unoptimized

## Checklist

- [ ] `logger.child()` is used per-request so `requestId` is in every log line
- [ ] Feed generation logs count and duration
- [ ] Post creation logs author and content length (not content itself)
- [ ] Error logs include the full error object and request context

## Next Step

Add tests so we can refactor safely.
