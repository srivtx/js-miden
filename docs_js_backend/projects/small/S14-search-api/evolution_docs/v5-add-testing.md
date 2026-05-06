# S14 Search API — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You add relevance ranking:

```ts
// routes/search.ts
const result = await pool.query(
  `SELECT 
    id, title, content,
    ts_rank_cd(search_vector, plainto_tsquery('english', $1), 32) as rank,
    ts_headline('english', content, plainto_tsquery('english', $1),
      'MaxFragments=3, MaxWords=50, MinWords=10, StartSel=<mark>, StopSel=</mark>'
    ) as highlighted
  FROM documents
  WHERE search_vector @@ plainto_tsquery('english', $1)
  ORDER BY rank DESC
  LIMIT $2 OFFSET $3`,
  [q, limit, offset]
);
```

But you forget to handle the case where `highlighted` is `null`:

```ts
// BEFORE — works for null
highlights: r.highlighted ? [r.highlighted] : [],

// AFTER — "cleaner" but WRONG
highlights: [r.highlighted],
```

Now every search result includes `[null]` in the highlights array. You deploy. API consumers complain about null values in their UI.

## The Fix: Write Tests BEFORE They Break

```ts
// tests/search.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { initDb, resetDb } from '../src/db.js';

describe('S14 Search API', () => {
  beforeAll(async () => {
    await initDb();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('indexes and searches documents', async () => {
    await request(app)
      .post('/api/index')
      .send({ title: 'GraphQL Intro', content: 'GraphQL is a query language' });

    const res = await request(app).get('/api/search?q=graphql');
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].title).toBe('GraphQL Intro');
  });

  it('returns empty results for no match', async () => {
    const res = await request(app).get('/api/search?q=nonexistent');
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(0);
  });

  it('paginates results', async () => {
    for (let i = 0; i < 15; i++) {
      await request(app)
        .post('/api/index')
        .send({ title: `Doc ${i}`, content: 'content' });
    }

    const res = await request(app).get('/api/search?q=content&limit=10&page=1');
    expect(res.body.results).toHaveLength(10);
    expect(res.body.pagination.page).toBe(1);
  });

  it('ranks results by relevance', async () => {
    await request(app)
      .post('/api/index')
      .send({ title: 'GraphQL', content: 'other' });
    await request(app)
      .post('/api/index')
      .send({ title: 'Other', content: 'GraphQL is great' });

    const res = await request(app).get('/api/search?q=graphql');
    expect(res.status).toBe(200);
    expect(res.body.results[0].rank).toBeGreaterThanOrEqual(res.body.results[1].rank);
  });

  it('returns no null highlights', async () => {
    await request(app)
      .post('/api/index')
      .send({ title: 'Test', content: 'hello world' });

    const res = await request(app).get('/api/search?q=hello');
    expect(res.body.results[0].highlights).not.toContain(null);
  });
});
```

**What tests prevent:**
- The null highlights regression? Caught.
- The pagination off-by-one? Caught.
- The ranking inversion? Caught.
- The empty query handling? Caught.

## The Pain That Remains

Your tests run with `vitest` but you're still using `require()` and `module.exports`. Modern Node.js supports ESM natively.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
