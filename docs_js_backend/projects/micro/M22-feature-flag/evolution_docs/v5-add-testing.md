# v5: Add Testing — Feature Flag Service

## The Pain

You change the consistent hashing algorithm from `md5` to `sha256`. It compiles. You deploy. Now 50% of users see different feature states. You don't know until support tickets flood in.

Without tests, every refactor is a production deploy gamble.

## The Solution

Add Jest + Supertest. Test the exact contracts that matter.

## The Test File

```typescript
// tests/feature-flag.test.ts
import request from 'supertest';
import { app, service } from '../src/index.js';

describe('Feature Flag', () => {
  beforeEach(() => {
    service.setFlag({ name: 'test-flag', enabled: true, rolloutPercentage: 50 });
  });

  it('should return disabled for non-existent flag', async () => {
    const res = await request(app).get('/flags/nonexistent');
    expect(res.body.enabled).toBe(false);
  });

  it('should return consistent result for same user', async () => {
    const userId = 'user-123';
    const results: boolean[] = [];

    for (let i = 0; i < 20; i++) {
      const res = await request(app).get(`/flags/test-flag?userId=${userId}`);
      results.push(res.body.enabled);
    }

    const allSame = results.every(r => r === results[0]);
    expect(allSame).toBe(true); // Consistent hashing must be deterministic
  });

  it('should allow user-specific override', async () => {
    service.setFlag({
      name: 'test-flag',
      enabled: true,
      rolloutPercentage: 0,
      userIds: ['admin-1'],
    });

    const res = await request(app).get('/flags/test-flag?userId=admin-1');
    expect(res.body.enabled).toBe(true);
  });

  it('should respect disabled flag', async () => {
    service.setFlag({ name: 'disabled-flag', enabled: false, rolloutPercentage: 100 });
    const res = await request(app).get('/flags/disabled-flag?userId=anyone');
    expect(res.body.enabled).toBe(false);
  });

  it('should support gradual percentage rollout', async () => {
    service.setFlag({ name: 'gradual', enabled: true, rolloutPercentage: 10 });

    let enabledCount = 0;
    const totalUsers = 100;

    for (let i = 0; i < totalUsers; i++) {
      const res = await request(app).get(`/flags/gradual?userId=user-${i}`);
      if (res.body.enabled) enabledCount++;
    }

    const percentage = (enabledCount / totalUsers) * 100;
    expect(percentage).toBeGreaterThanOrEqual(5);
    expect(percentage).toBeLessThanOrEqual(15);
  });
});
```

## The Bug It Catches

Before adding this test suite, the code used `Math.random()` for rollout:

```typescript
if (flag.rolloutPercentage > 0) {
  const randomValue = Math.random() * 100;
  return randomValue <= flag.rolloutPercentage;
}
```

The test `should return consistent result for same user` catches this immediately. A user gets `true` on request 1, `false` on request 2, `true` on request 3 — `allSame` is `false`, test fails.

## Why Tests Catch Breakage Before Deploy

- **Determinism**: `consistent result for same user` guarantees hash stability
- **Bounds**: `gradual percentage rollout` catches off-by-one errors in modulo math
- **Overrides**: `user-specific override` ensures VIP users always get features
- **Safety**: `disabled flag` prevents accidentally exposing unfinished work

Without tests, the `Math.random()` bug ships. With tests, it is caught in `npm test` before CI even builds a Docker image.
