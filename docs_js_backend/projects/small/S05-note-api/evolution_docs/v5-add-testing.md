# v5 — Add Testing (Note API)

## The Scenario

It's 2am. Your junior refactors search to use full-text search. "It should be faster," they say. They deploy. Users report "search returns no results for 'database design'." The junior tested with single words. Phrase search broke. Without tests, this ships.

## The PAIN: Search Refactors Are Dangerous

From v4:

```typescript
if (q) {
  rows = await pool.query(
    `SELECT * FROM notes WHERE deleted_at IS NULL AND content ILIKE $1 ORDER BY id LIMIT $2 OFFSET $3`,
    [`%${q}%`, limit, offset]
  );
}
```

This `ILIKE` approach works for single words. Refactor to `to_tsvector` and suddenly:
- Phrase search breaks
- Partial word matching changes
- Stop words are ignored
- Relevance ranking shifts

Without tests, you don't know search degraded until users complain.

## The Solution: Vitest + Supertest + Database

```typescript
// tests/notes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool, initDb } from '../src/db.js';

beforeAll(async () => {
  await initDb();
  await pool.query("DELETE FROM notes WHERE title LIKE 'test-%'");
});

afterAll(async () => {
  await pool.end();
});

describe('S05 Note API', () => {
  it('creates a note', async () => {
    const res = await request(app).post('/notes').send({
      title: 'test-a',
      content: 'hello world',
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('test-a');
  });

  it('lists notes with pagination', async () => {
    const res = await request(app).get('/notes?page=1&limit=5');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('searches notes', async () => {
    // Create a note first
    await request(app).post('/notes').send({
      title: 'test-search',
      content: 'database design patterns',
    });
    
    const res = await request(app).get('/notes?q=database');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.some((n: any) => n.content.includes('database'))).toBe(true);
  });

  it('searches with phrase', async () => {
    const res = await request(app).get('/notes?q=database design');
    expect(res.status).toBe(200);
    // ILIKE '%database design%' should match
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('returns empty for non-matching search', async () => {
    const res = await request(app).get('/notes?q=xyznonexistent');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('updates a note', async () => {
    const create = await request(app).post('/notes').send({
      title: 'test-b',
      content: 'update me',
    });
    const id = create.body.id;
    
    const res = await request(app)
      .put(`/notes/${id}`)
      .send({ title: 'test-b-updated', content: 'updated' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('test-b-updated');
  });

  it('soft deletes a note', async () => {
    const create = await request(app).post('/notes').send({
      title: 'test-c',
      content: 'delete me',
    });
    const id = create.body.id;
    
    await request(app).delete(`/notes/${id}`).expect(204);
    await request(app).get(`/notes/${id}`).expect(404);
    
    // Search should not find deleted notes
    const search = await request(app).get(`/notes?q=delete me`);
    expect(search.body.data.some((n: any) => n.id === id)).toBe(false);
  });

  it('prevents SQL injection in search', async () => {
    const res = await request(app).get("/notes?q='; DROP TABLE notes; --");
    expect(res.status).toBe(400); // or 200 with safe results
    // Most importantly: the table should still exist
    const list = await request(app).get('/notes');
    expect(list.status).toBe(200);
  });
});
```

### What testing catches:

| Scenario | Without tests | With tests |
|----------|--------------|------------|
| Search refactor breaks phrases | Users get zero results | **Test checks** phrase matching |
| Soft delete bypassed | Deleted notes in search | **Test verifies** exclusion |
| SQL injection regression | Data loss | **Test sends** payload, verifies table survives |
| Pagination off-by-one | Wrong page counts | **Test checks** pagination object |
| Update clears fields | Data loss | **Test verifies** field persistence |

## The PAIN of Database State

```typescript
// DON'T share database state between tests:
it('creates note', async () => {
  await request(app).post('/notes').send({ title: 'A', content: 'B' });
  // Note exists now
});

it('lists notes', async () => {
  const res = await request(app).get('/notes');
  // How many notes? Depends on previous tests. Flaky!
});

// DO isolate state:
beforeEach(async () => {
  await pool.query("DELETE FROM notes WHERE title LIKE 'test-%'");
});
```

Our tests use `test-` prefixed titles and clean them up in `beforeAll`.

## Testing Evolution in Note API

| Version | Testing | Search confidence |
|---------|---------|------------------|
| v1 (JS) | Manual SQL queries | Zero |
| v2-4 | Still manual | Zero |
| v5 (Vitest) | CRUD + search + injection tested | High |

## The Realization

> Junior: "I added a test that searches for 'database design' as a phrase. When I refactored to full-text search, the test failed — tsvector doesn't match partial phrases the same way. I caught the regression before deploy."
> 
> You: "Search is the most tested-yet-broken feature in every app. Users search for things you never thought of. Tests for search must cover: single words, phrases, empty results, special characters, and injection attempts."

## The Next PAIN

Tests pass with `ts-node`. But `tsc` compilation fails because of module resolution. Your `import` statements use `.js` extensions that TypeScript complains about. Or you use CommonJS and ESM packages can't be imported. The module wars continue.

## Next: v6 — Switch to ESM
