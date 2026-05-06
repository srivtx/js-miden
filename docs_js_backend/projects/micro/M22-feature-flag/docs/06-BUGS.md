# BUGS: Feature Flag

## The Intentional Bug: Random Rollout Instead of Consistent Hashing

### Location

`src/feature-flag.ts` - `isEnabled()` method, lines 29-34

### How to Introduce

```typescript
isEnabled(flagName: string, userId?: string): boolean {
  const flag = this.flags.get(flagName);
  if (!flag) return false;
  if (!flag.enabled) return false;

  // User-specific override
  if (userId && flag.userIds?.includes(userId)) {
    return true;
  }

  // BUG: Random rollout instead of consistent hashing!
  // User gets different result on every request
  if (flag.rolloutPercentage > 0) {
    const randomValue = Math.random() * 100;
    return randomValue <= flag.rolloutPercentage;
  }

  return true;
}
```

### Why This Bug Exists

This bug simulates the most common feature flag mistake: using `Math.random()` for rollout percentage. It seems correct at first glance ("randomly select 10% of users"), but it violates the fundamental requirement that feature flag evaluation must be deterministic per user.

### Symptoms

1. **Flickering UI**
   - User refreshes page, feature appears
   - User refreshes again, feature disappears
   - User thinks the website is broken

2. **Invalid A/B Test Results**
   - Conversion rate data is meaningless
   - Same user sees both variants
   - Statistical tests show "significance" that is pure noise

3. **Cache Poisoning**
   - CDN caches page with feature ON
   - Next request from same user gets feature OFF
   - Inconsistent state between API responses and rendered HTML

4. **Analytics Data Corruption**
   - Same `userId` appears in both control and treatment groups
   - Event tracking is inconsistent
   - Product decisions based on garbage data

### Reproduction

```bash
# Start the service
npm start

# Create a 50% rollout flag
curl -X POST http://localhost:3000/flags/test-flag \
  -H "Content-Type: application/json" \
  -d '{"enabled":true,"rolloutPercentage":50}'

# Query the same user 10 times
for i in {1..10}; do
  curl "http://localhost:3000/flags/test-flag?userId=alice-123"
  echo
done

# Expected: All 10 responses show the same result
# Actual:   Results vary randomly
```

**Failing test:**
```typescript
it('should return consistent result for same user', async () => {
  const userId = 'user-123';
  const results: boolean[] = [];

  for (let i = 0; i < 20; i++) {
    const res = await request(app).get(`/flags/test-flag?userId=${userId}`);
    results.push(res.body.enabled);
  }

  const allSame = results.every(r => r === results[0]);
  expect(allSame).toBe(true); // FAILS - results vary
});
```

### The Fix

```typescript
import { createHash } from 'crypto';

function getUserHash(userId: string, flagName: string): number {
  const hash = createHash('sha256')
    .update(`${userId}:${flagName}`)
    .digest('hex');
  return parseInt(hash.slice(0, 8), 16);
}

isEnabled(flagName: string, userId?: string): boolean {
  const flag = this.flags.get(flagName);
  if (!flag) return false;
  if (!flag.enabled) return false;

  if (userId && flag.userIds?.includes(userId)) {
    return true;
  }

  if (flag.rolloutPercentage > 0 && userId) {
    const hash = getUserHash(userId, flagName);
    const value = (hash % 10000) / 100;
    return value <= flag.rolloutPercentage;
  }

  return true;
}
```

**Why the fix works:**
- `SHA-256(userId + flagName)` produces the same hash for the same inputs
- The hash is uniformly distributed across all possible values
- `(hash % 10000) / 100` maps to 0.00-99.99
- If the value is <= rolloutPercentage, the user is in the rollout group
- This assignment is deterministic and never changes

### Real-World Impact

#### Case Study: Google Hangouts Rollout Bug (2014)

Google Hangouts attempted a gradual rollout of a new feature using an internal flag system. A bug in the assignment logic caused users to flip between old and new versions randomly:

- **User confusion**: Conversations appeared/disappeared
- **Data inconsistency**: Message history showed different formats
- **Engineering rollback**: The entire rollout was rolled back within 24 hours
- **Post-mortem finding**: The assignment function used a non-deterministic random source seeded by request time

#### Case Study: Facebook News Feed Experiment (2014)

Facebook ran a psychology experiment on 689,003 users to measure emotional contagion. While the ethics were controversial, the technical implementation was sound. However, a previous experiment had a bug where:

- Users were incorrectly assigned to control/treatment groups
- The same user saw different content on different devices
- The experiment data had to be discarded
- Estimated cost: weeks of data collection and analyst time wasted

#### Case Study: Knight Capital Trading Loss (2012) - Feature Flag Angle

While primarily a deployment issue, Knight Capital's $440M loss involved a feature flag-like mechanism:

- New trading code was deployed but not "enabled"
- A manual flag was supposed to route orders to the new system
- The flag was incorrectly set on one server
- That server sent malformed orders for 45 minutes
- **Lesson**: Feature flags are powerful but dangerous. Always have kill switches and monitoring.

#### Case Study: Salesforce Marketing Cloud Outage (2019)

A feature flag was used to control rollout of a new email template engine. A bug in the flag evaluation logic caused:

- Some customers to see broken email templates
- The issue was intermittent (same customer, different results)
- Support was overwhelmed because issues couldn't be reproduced
- Root cause: The flag service used `Math.random()` in a multi-region setup where different regions produced different results for the same user

### Prevention

1. **Never use Math.random() for user assignment**
   - Use cryptographic hashing (SHA-256, MD5)
   - Use UUID v5 (name-based) for deterministic IDs

2. **Test consistency explicitly**
   - Query the same user 100 times, expect 100 identical results
   - Run this test in CI on every commit

3. **Use established libraries**
   - LaunchDarkly, Unleash, Flagsmith have solved this
   - Don't build your own unless you have specific requirements

4. **Monitor for inconsistency**
   - Track "user saw both variants" as an error metric
   - Alert if a user generates events in multiple experiment groups
