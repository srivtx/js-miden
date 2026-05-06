# MD09 Social Feed Engine — v3 Add Validation

> **Motto**: Validate the post before it posts.

## What Changed

Added `zod` schemas for every inbound request. Validation runs before any feed operation. Invalid posts, users, or pagination params return `400` with a clear error message.

## Why

- **Feed integrity**: A post with 10MB of text could break the client
- **Security**: Prevents injection via `content` or `username` fields
- **Contract**: The zod schema *is* the API contract

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│     Zod         │─────▶│  In-Memory      │
│  (Reader)   │◀─────│  (validate)     │◀─────│  Maps           │
└─────────────┘      └─────────────────┘      └─────────────────┘
                            │
                            ▼ (400 Bad Request)
                     ┌─────────────────┐
                     │  Clear error    │
                     │  { field, msg } │
                     └─────────────────┘
```

## Code

```typescript
// src/validators/posts.ts
import { z } from 'zod';

export const createPostSchema = z.object({
  authorId: z.string().uuid(),
  content: z.string().min(1).max(280),
});

export const feedQuerySchema = z.object({
  offset: z.string().regex(/^\d+$/).transform(Number).default('0'),
  limit: z.string().regex(/^\d+$/).transform(Number).max(100).default('20'),
});

// src/middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        issues: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

// src/routes/posts.ts
import { createPostSchema } from '../validators/posts.js';
import { validateBody } from '../middleware/validate.js';

app.post('/posts', validateBody(createPostSchema), (req: Request, res: Response) => {
  // ... create post
});
```

## Decisions

**Option A: Central validator file**
- Pros: All schemas in one place
- Cons: Merge conflicts

**Option B: Per-route validator modules**
- Pros: Scales with team size
- Cons: More files

**Chosen: B** — only 2 routes; easy to manage.

## Problems We Accepted

- Validation is only at the API layer; in-memory store doesn't enforce constraints
- No auth — anyone can post as anyone
- Still no database

## Checklist

- [ ] Every `POST` / `PUT` route has a zod schema
- [ ] `content` is bounded to 280 characters (Twitter-style)
- [ ] `limit` is capped at 100
- [ ] Validation middleware runs before auth (fail fast on garbage)

## Next Step

Add structured logging so we can trace feed requests.
