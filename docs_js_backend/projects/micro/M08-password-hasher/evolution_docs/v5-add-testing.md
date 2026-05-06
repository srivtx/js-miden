# v5-add-testing.md — Password Hasher

## The Pain

We added logging (v4), but a "simple refactor" broke verification silently:

```typescript
// "Refactor": extract hash function
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

app.post('/verify', (req, res) => {
  const { password, hash } = parse.data;
  const computed = hashPassword(password);
  const match = computed === hash;  // still vulnerable to timing attack
  res.json({ match });
});
```

A week later, a junior developer changed `hashPassword` to use bcrypt (good!) but forgot to update `/verify` to compare with bcrypt. The tests **passed** because we had no tests.

Then we deployed. Every login returned `{ match: false }`. Users couldn't log in. We rolled back after 30 minutes of downtime.

## The Fix: Add Tests

```typescript
// tests/hash.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('POST /hash', () => {
  it('returns a 64-char hex sha256 hash', async () => {
    const res = await request(app).post('/hash').send({ password: 'secret' });
    expect(res.status).toBe(200);
    expect(res.body.hash).toHaveLength(64);
    expect(res.body.hash).toMatch(/^[a-f0-9]+$/);
  });

  it('returns identical hash for identical passwords (no salt bug)', async () => {
    const res1 = await request(app).post('/hash').send({ password: 'abc' });
    const res2 = await request(app).post('/hash').send({ password: 'abc' });
    expect(res1.body.hash).toBe(res2.body.hash);
    // This test DOCUMENTS the bug: identical passwords → identical hashes
  });
});

describe('POST /verify', () => {
  it('returns true for a matching password', async () => {
    const hashRes = await request(app).post('/hash').send({ password: 'secret' });
    const verifyRes = await request(app)
      .post('/verify')
      .send({ password: 'secret', hash: hashRes.body.hash });
    expect(verifyRes.body.match).toBe(true);
  });

  it('returns false for a non-matching password', async () => {
    const verifyRes = await request(app)
      .post('/verify')
      .send({ password: 'wrong', hash: 'a'.repeat(64) });
    expect(verifyRes.body.match).toBe(false);
  });
});
```

## What Tests Caught

1. **No-salt bug:** The test `returns identical hash for identical passwords` documents that SHA-256 without salt is predictable.
2. **Timing attack:** We added a test that measures comparison time for hashes differing at byte 1 vs byte 63. `===` is measurably faster for early mismatches.
3. **Refactor safety:** Changing the hash algorithm now requires updating both `/hash` and `/verify` tests.

## But Tests Don't Fix the Algorithm

Tests document and detect regressions, but they don't make SHA-256 suitable for passwords. We still need Argon2 + timingSafeEqual (see v7).

> **Lesson:** Tests prevent silent breakage during refactoring. They also serve as executable documentation of known bugs.
