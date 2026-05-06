# v5 — Add Testing (Contact Form)

## The Scenario

It's 2am. Your junior adds rate limiting. "It should block spammers now," they say. They deploy. A legitimate user gets blocked after 2 submissions. Why? The rate limiter uses IP, but the app is behind a load balancer — all requests have the same IP. Your junior never tested the rate limiter.

## The PAIN: Untested Middleware Is Broken Middleware

From v4:

```typescript
router.post('/contact', validateContact, (req, res) => {
  // Rate limiter imported but NOT applied!
  // This is the actual bug in the codebase.
});
```

Without tests, this bug is invisible. The rate limiter exists. It's imported. It's just not used.

## The Solution: Vitest + Supertest + Redis

```typescript
// tests/contact.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

describe('POST /contact', () => {
  beforeAll(async () => {
    await redis.flushall();
  });

  afterAll(async () => {
    await redis.flushall();
    await redis.quit();
  });

  it('accepts valid submissions', async () => {
    const res = await request(app)
      .post('/contact')
      .send({ name: 'Alice', email: 'alice@example.com', message: 'Hello!' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects invalid email', async () => {
    const res = await request(app)
      .post('/contact')
      .send({ name: 'Bob', email: 'not-an-email', message: 'Hello' });
    expect(res.status).toBe(400);
  });

  it('rejects empty message', async () => {
    const res = await request(app)
      .post('/contact')
      .send({ name: 'Charlie', email: 'charlie@example.com', message: '' });
    expect(res.status).toBe(400);
  });

  it('catches bots via honeypot', async () => {
    const res = await request(app)
      .post('/contact')
      .send({
        name: 'Bot',
        email: 'bot@example.com',
        message: 'Spam',
        website: 'http://spam.com',
      });
    // Honeypot returns 200 to avoid tipping off bots
    expect(res.status).toBe(200);
  });

  // This test documents the BUG
  it('BUG: allows more than 3 submissions without rate limiting', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/contact')
        .send({
          name: `Spammer ${i}`,
          email: `spam${i}@example.com`,
          message: 'Spam content',
        });
      // All succeed because rateLimiter is not applied to the route
      expect(res.status).toBe(200);
    }
  });
});
```

### What testing catches:

| Scenario | Without tests | With tests |
|----------|--------------|------------|
| Rate limiter not applied | Production spam | **Test documents** missing middleware |
| Validation bypass | Garbage data stored | **Test rejects** invalid input |
| Honeypot broken | Bots get real errors | **Test verifies** silent rejection |
| Redis down | Fail-closed (all blocked) | **Test checks** fail-open behavior |
| Email regex wrong | Invalid emails accepted | **Test rejects** `not-an-email` |

## The PAIN of Integration Testing

```typescript
// Unit test for validator alone:
it('validates email format', () => {
  expect(validator.isEmail('test@test.com')).toBe(true);
  expect(validator.isEmail('invalid')).toBe(false);
});

// Integration test for the full route:
it('rejects invalid email through the API', async () => {
  const res = await request(app)
    .post('/contact')
    .send({ name: 'Test', email: 'invalid', message: 'Hello' });
  expect(res.status).toBe(400);
});
```

Unit tests verify functions. Integration tests verify the **system**. Both are necessary.

## Testing the Rate Limiter (When Fixed)

```typescript
it('rate limits after 3 requests', async () => {
  // Make 3 valid requests
  for (let i = 0; i < 3; i++) {
    const res = await request(app).post('/contact').send({
      name: `User ${i}`, email: `user${i}@test.com`, message: 'Hi',
    });
    expect(res.status).toBe(200);
  }
  
  // 4th request should be blocked
  const res = await request(app).post('/contact').send({
    name: 'Blocked', email: 'blocked@test.com', message: 'Hi',
  });
  expect(res.status).toBe(429);
  expect(res.body.error).toContain('Too many requests');
});
```

## Testing Evolution in Contact Form

| Version | Testing | Confidence |
|---------|---------|------------|
| v1 (JS) | Manual form submit | Zero |
| v2-4 | Still manual | Zero |
| v5 (Vitest) | Automated validation, honeypot, rate limit tests | High |

## The Realization

> Junior: "The test `BUG: allows more than 3 submissions` passes. That's weird. Oh — the rate limiter isn't applied to the route! The test found the bug."
> 
> You: "Tests that document known bugs are more valuable than tests that only pass. They prevent the 'I didn't know that was broken' conversation. They're your insurance policy."

## The Next PAIN

Tests work locally. But if your test imports use `require()` and your source uses `import`, Jest/Vitest config becomes a nightmare. CommonJS vs ESM is the silent killer of JavaScript projects.

## Next: v6 — Switch to ESM
