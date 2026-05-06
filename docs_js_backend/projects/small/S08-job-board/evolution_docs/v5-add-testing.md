# v5 — Adding Tests

You just refactored your filter logic. You replaced string concatenation with parameterized queries. You think it's safer. You deploy.

An hour later, a user reports that sorting by `salary_max` doesn't work. You check. It sorts by `posted_date` instead. You had a typo in your SQL: `ORDER BY ${sortColum}` (missing the `n`).

Tests would have caught this in 50 milliseconds.

## The Fix: Automated Tests

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Job Board API', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM jobs').run();
  });

  it('creates a job', async () => {
    const res = await request(app).post('/jobs').send({
      title: 'Backend Engineer',
      company: 'Acme',
      location: 'Remote',
      salary_min: 100000,
      salary_max: 150000,
      type: 'full-time',
      remote: true,
    });
    expect(res.status).toBe(201);
  });

  it('filters by type and remote', async () => {
    await seedJobs(); // helper
    const res = await request(app).get('/jobs?type=full-time&remote=true');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Backend Dev');
  });

  it('sorts by salary_min ascending', async () => {
    await seedJobs();
    const res = await request(app).get('/jobs?sort_by=salary_min&order=asc');
    expect(res.body[0].salary_min).toBeLessThan(res.body[1].salary_min);
  });

  it('rejects SQL injection attempts', async () => {
    const res = await request(app).get("/jobs?type=' OR '1'='1");
    // Should return empty or 400, not all jobs
    expect(res.body).toHaveLength(0);
  });
});
```

## What Tests Caught

- The sorting typo → caught
- The SQL injection vulnerability → caught
- The float salary bug → caught with a dedicated test

## The Confidence

Green tests mean you can refactor fearlessly. You change the database layer. Tests pass. You optimize a query. Tests pass. You sleep better.

**Next:** Let's modernize the module system.
