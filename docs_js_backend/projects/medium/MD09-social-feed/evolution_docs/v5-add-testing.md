# MD09 Social Feed Engine — v5 Add Testing

> **Motto**: Test the feed before the users do.

## What Changed

Added `vitest` + `supertest`. Unit tests for validators, service tests for feed generation, and integration tests for the full post → feed flow.

## Why

- **Reliability**: A broken feed affects every user
- **Refactoring**: v6 (ESM) and v7 (fan-out, caching) will touch every file — tests prove nothing broke
- **Documentation**: Tests show the intended behavior better than prose

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Vitest        │─────▶│   Supertest     │─────▶│   Express App   │
│   (runner)      │      │   (HTTP client) │      │   (in-memory)   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

## Code

```typescript
// tests/feed.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('GET /feed', () => {
  it('returns posts in reverse chronological order', async () => {
    // Seed posts
    await request(app).post('/posts').send({ authorId: 'user-1', content: 'First' });
    await new Promise(r => setTimeout(r, 10));
    await request(app).post('/posts').send({ authorId: 'user-1', content: 'Second' });

    const res = await request(app).get('/feed').expect(200);
    expect(res.body.posts[0].content).toBe('Second');
    expect(res.body.posts[1].content).toBe('First');
  });

  it('rejects posts that exceed max length', async () => {
    const res = await request(app)
      .post('/posts')
      .send({ authorId: 'user-1', content: 'a'.repeat(281) })
      .expect(400);

    expect(res.body.issues).toContainEqual(
      expect.objectContaining({ field: 'content', message: 'String must contain at most 280 character(s)' })
    );
  });

  it('handles likes', async () => {
    const postRes = await request(app)
      .post('/posts')
      .send({ authorId: 'user-1', content: 'Like me' })
      .expect(201);

    const postId = postRes.body.id;
    await request(app).post(`/posts/${postId}/like`).set('x-user-id', 'user-2').expect(200);

    const feedRes = await request(app).get('/feed').expect(200);
    const likedPost = feedRes.body.posts.find((p: any) => p.id === postId);
    expect(likedPost.likes).toBe(1);
  });
});
```

## Decisions

**Option A: Jest**
- Pros: Ubiquitous, snapshot testing
- Cons: ESM support is painful, slower

**Option B: Vitest**
- Pros: Native ESM, Jest-compatible API, fast
- Cons: Smaller ecosystem

**Chosen: Vitest** — aligns with v6 ESM switch.

## Problems We Accepted

- Feed tests require seeding data; no database cleanup between tests
- No load tests yet
- Fan-out logic is not yet tested

## Checklist

- [ ] All routes have at least one happy-path and one error test
- [ ] Zod validation failures are tested with precise error shapes
- [ ] Feed order is tested (reverse chronological)
- [ ] Tests run in < 5 seconds for the entire suite
- [ ] Coverage report is generated; target 80%+ for services

## Next Step

Switch to ESM so we can use top-level await and tree-shake.
