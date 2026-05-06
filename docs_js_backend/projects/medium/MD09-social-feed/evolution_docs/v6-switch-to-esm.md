# MD09 Social Feed Engine — v6 Switch to ESM

> **Motto**: ESM is the future; CommonJS is the past.

## What Changed

Converted the entire codebase from CommonJS (`require`, `module.exports`) to ESM (`import`, `export`). Updated `tsconfig.json` to `"module": "NodeNext"`, renamed imports to include `.js` extensions.

## Why

- **Tree-shaking**: Drops unused lodash functions under ESM
- **Top-level await**: `await redis.ping()` in module scope for health checks
- **Future-proof**: Node.js 20+ treats ESM as first-class

## Architecture

No architecture change — same boxes, better wires.

## Code

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

```json
// package.json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  }
}
```

```typescript
// src/routes/posts.ts
import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { posts, userFeeds, likes, retweets, users } from '../db.js';
import { config } from '../config.js';
import type { Post } from '../types.js';

const router = Router();

function fanOutPost(post: Post) {
  const allUsers = Array.from(users.values());
  for (const user of allUsers) {
    const feed = userFeeds.get(user.id) || [];
    feed.unshift(post.id);
    userFeeds.set(user.id, feed);
  }
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
  fanOutPost(post);
  res.status(201).json(post);
});

export { router as postsRouter };
```

## Decisions

**Option A: Keep CommonJS, use dynamic import for ESM-only deps**
- Pros: Zero migration cost
- Cons: Fragmented codebase, loses top-level await

**Option B: Full ESM migration**
- Pros: Clean, consistent, future-proof
- Cons: Must add `.js` extensions to all relative imports

**Chosen: B** — the project is medium-sized; migration took 30 minutes.

## Problems We Accepted

- Some `@types/*` packages assume CommonJS; needed to update `tsconfig.json` `esModuleInterop`
- `__dirname` no longer exists; replaced with `fileURLToPath(import.meta.url)`
- Vitest config needed `globals: false` to avoid CJS interop issues

## Checklist

- [ ] `"type": "module"` is in `package.json`
- [ ] All relative imports end with `.js`
- [ ] `tsconfig.json` uses `"module": "NodeNext"`
- [ ] No `require()` or `module.exports` remains in `src/`
- [ ] Tests pass under ESM (vitest handles this natively)

## Next Step

Production setup: fan-out, ranking, cursor pagination, and caching.
