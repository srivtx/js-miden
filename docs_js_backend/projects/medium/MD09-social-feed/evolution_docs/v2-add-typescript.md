# MD09 Social Feed Engine — v2 Add TypeScript

> **Motto**: Types are the contract of your feed.

## What Changed

Migrated to TypeScript. Added `tsconfig.json`, interfaces for `Post`, `User`, and `FeedResponse`. Replaced the in-memory Map with typed Maps. Added strict null checks.

## Why

- **Feed shapes vary**: A `Post` has `likes`, `retweets`, and `createdAt`; a `User` has `followers` and `following` — types prevent mixing them up
- **Refactoring safety**: Renaming `Post.authorId` catches all feed generation references
- **Team velocity**: New engineers understand the domain model without runtime exploration

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│  Express + TS   │─────▶│  In-Memory      │
│  (Reader)   │◀─────│  (typed posts)  │◀─────│  Maps           │
└─────────────┘      └─────────────────┘      └─────────────────┘
```

## Code

```typescript
// src/types.ts
export interface Post {
  id: string;
  authorId: string;
  content: string;
  likes: number;
  retweets: number;
  createdAt: Date;
}

export interface User {
  id: string;
  username: string;
  followers: string[];
  following: string[];
}

export interface FeedResponse {
  posts: Post[];
  offset: number;
  limit: number;
  total: number;
}

// src/server.ts
import express, { Request, Response } from 'express';
import { Post, User, FeedResponse } from './types.js';

const app = express();
app.use(express.json());

const posts = new Map<string, Post>();
const users = new Map<string, User>();
const userFeeds = new Map<string, string[]>();

app.post('/posts', (req: Request, res: Response) => {
  const post: Post = {
    id: crypto.randomUUID(),
    authorId: req.body.authorId,
    content: req.body.content,
    likes: 0,
    retweets: 0,
    createdAt: new Date(),
  };
  posts.set(post.id, post);
  res.status(201).json(post);
});

app.get('/feed', (req: Request, res: Response) => {
  const offset = parseInt(req.query.offset as string) || 0;
  const limit = parseInt(req.query.limit as string) || 20;

  const allPosts = Array.from(posts.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const paginated = allPosts.slice(offset, offset + limit);

  const response: FeedResponse = {
    posts: paginated,
    offset,
    limit,
    total: allPosts.length,
  };

  res.json(response);
});
```

## Decisions

**Option A: In-memory Maps for everything**
- Pros: Fast, simple
- Cons: Lost on restart, doesn't scale

**Option B: PostgreSQL from day one**
- Pros: Persistent, scalable
- Cons: Adds complexity for an MVP

**Chosen: A for v1-v2** — we'll add PostgreSQL in v7.

## Problems We Accepted

- Still no followers — everyone sees every post
- Still no pagination safety
- Still no database

## Checklist

- [ ] `tsconfig.json` has `strict: true`
- [ ] All route handlers use explicit `Request` / `Response` types
- [ ] `Post` and `User` interfaces are shared across routes
- [ ] No `any` in the feed generation

## Next Step

Add runtime validation so bad payloads fail before they reach the feed.
