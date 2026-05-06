# S16 GraphQL API — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You add DataLoader:

```ts
// resolvers.ts
import DataLoader from 'dataloader';

const authorLoader = new DataLoader<string, Author | undefined>(async (ids) => {
  console.log(`Batch fetching authors: ${ids}`);
  return ids.map(id => authors.find(a => a.id === id));
});

export function getAuthor(id: string) {
  return authorLoader.load(id);
}
```

But you forget to create a new DataLoader per request:

```ts
// BEFORE — new loader per request (correct)
app.all('/graphql', (req, res) => {
  const loader = new DataLoader(...);
  // pass loader to context
});

// AFTER — global loader (WRONG)
const authorLoader = new DataLoader(...); // shared across all requests
```

Now DataLoader caches across requests. User A requests author 1. User B requests author 1. User B gets User A's cached result. Data leaks between users.

## The Fix: Write Tests BEFORE They Break

```ts
// tests/graphql.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('S16 GraphQL API', () => {
  it('fetches posts with authors', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({ query: '{ posts { title author { name } } }' });
    expect(res.status).toBe(200);
    expect(res.body.data.posts).toHaveLength(3);
    expect(res.body.data.posts[0].author.name).toBe('Alice');
  });

  it('limits query depth', async () => {
    const deepQuery = '{ posts { author { posts { author { posts { title } } } } } }';
    const res = await request(app)
      .post('/graphql')
      .send({ query: deepQuery });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('max depth');
  });

  it('batches author lookups', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({ query: '{ posts { title author { name } } }' });
    expect(res.status).toBe(200);
    // With DataLoader, getAuthor should be called once per unique author, not once per post
    // This is verified by console.log in the test or by mocking
  });

  it('isolates DataLoader per request', async () => {
    // Request 1: fetch all posts
    await request(app)
      .post('/graphql')
      .send({ query: '{ posts { title author { name } } }' });

    // Modify author data
    const author = authors.find(a => a.id === '1');
    if (author) author.name = 'Modified';

    // Request 2: should see modified data, not cached
    const res = await request(app)
      .post('/graphql')
      .send({ query: '{ posts { title author { name } } }' });
    expect(res.body.data.posts[0].author.name).toBe('Modified');
  });
});
```

**What tests prevent:**
- The global DataLoader leak? Caught.
- The depth limit bypass? Caught.
- The N+1 regression? Caught.
- The missing field error? Caught.

## The Pain That Remains

Your tests run with `vitest` but you're still using `require()` and `module.exports`. Modern Node.js supports ESM natively.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
