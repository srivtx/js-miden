# v5-add-testing.md — Query Param Parser

## The Pain

We added validation (v3) and logging (v4), but a "quick fix" for pagination broke XSS prevention:

```typescript
// "Quick fix": return JSON instead of HTML to avoid XSS
app.get('/search', (req, res) => {
  const parse = searchSchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  const { query, page, limit } = parse.data;
  res.json({ query, page, limit, nextPage: page + 1 });
});
```

Then a product manager asked us to add an HTML preview endpoint:

```typescript
app.get('/search/preview', (req, res) => {
  const { query } = req.query;
  res.send(`<h1>Results for: ${query}</h1>`);  // XSS is back!
});
```

We had no tests for the preview endpoint. It shipped. A security researcher reported XSS within 24 hours.

## The Fix: Add Tests

```typescript
// tests/search.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('GET /search', () => {
  it('parses and reflects query params', async () => {
    const res = await request(app).get('/search?query=hello&page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ query: 'hello', page: 1, limit: 10 });
  });

  it('demonstrates string concatenation bug (nextPage)', async () => {
    const res = await request(app).get('/search?query=test&page=1&limit=10');
    expect(res.body.nextPage).toBe(2);
    // If this returns "11", the coercion bug is back
  });

  it('rejects negative page (validation bug)', async () => {
    const res = await request(app).get('/search?page=-5&limit=10');
    expect(res.status).toBe(400);
  });

  it('rejects huge limit (DoS bug)', async () => {
    const res = await request(app).get('/search?limit=99999999');
    expect(res.status).toBe(400);
  });

  it('does not reflect XSS payloads in HTML', async () => {
    const xss = '<script>alert(1)</script>';
    const res = await request(app).get(`/search/preview?query=${encodeURIComponent(xss)}`);
    expect(res.text).not.toContain('<script>');
    expect(res.text).toContain('&lt;script&gt;');
  });
});
```

## What Tests Caught

1. **String concat regression:** If `page` stops being coerced to a number, `nextPage` becomes `"11"`.
2. **Validation bypass:** If Zod schema is relaxed, negative page/huge limit slip through.
3. **XSS re-introduction:** Any new HTML endpoint must escape output — the test enforces this.

## But Tests Don't Fix Sanitization

Tests verify that `<script>` is escaped, but they don't guarantee all XSS vectors are covered. We need a systematic output encoding approach (see v7).

> **Lesson:** Tests catch regressions and document security requirements. But they can't test what you forgot to think about.
