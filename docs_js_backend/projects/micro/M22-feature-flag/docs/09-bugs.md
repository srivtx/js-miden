# Bugs: Feature Flag

## Bug 1: Random Rollout

### Location
`src/feature-flag.ts` - `isEnabled()` method

### The Bug

```typescript
if (flag.rolloutPercentage > 0) {
  const randomValue = Math.random() * 100;
  return randomValue <= flag.rolloutPercentage;
}
```

### Expected Behavior
Same user should always get the same result for the same flag.

### Actual Behavior
User gets different results on every request due to `Math.random()`.

### Impact
- Inconsistent user experience
- Invalid A/B test results
- Cache poisoning
- Analytics data corruption

### Failing Test
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
  // ...
  if (flag.rolloutPercentage > 0 && userId) {
    const hash = getUserHash(userId, flagName);
    const value = (hash % 10000) / 100;
    return value <= flag.rolloutPercentage;
  }
  // ...
}
```

---

## Bug 2: No Persistence

### Location
`src/feature-flag.ts` - `FeatureFlagService` class

### The Bug
Flags are stored only in a Map in memory. No persistence mechanism.

### Expected Behavior
Flags should survive server restarts.

### Actual Behavior
All flags reset to defaults on restart.

### Impact
- Rollouts restart from 0%
- Configuration lost on deploy
- No audit trail
- Operational risk

### Failing Test
```typescript
it('should persist across restarts', async () => {
  await request(app)
    .post('/flags/new-feature')
    .send({ enabled: true, rolloutPercentage: 50 });

  // Simulate restart
  const newService = new FeatureFlagService();
  await newService.load();

  expect(newService.getFlag('new-feature')).toBeDefined(); // FAILS
});
```

### The Fix
Add persistence to JSON file:

```typescript
private configPath = './flags.json';

async save(): Promise<void> {
  await fs.writeFile(
    this.configPath,
    JSON.stringify(Array.from(this.flags.values()), null, 2)
  );
}

async load(): Promise<void> {
  try {
    const data = await fs.readFile(this.configPath, 'utf-8');
    const flags = JSON.parse(data);
    for (const flag of flags) {
      this.flags.set(flag.name, flag);
    }
  } catch {
    // File doesn't exist yet
  }
}
```
