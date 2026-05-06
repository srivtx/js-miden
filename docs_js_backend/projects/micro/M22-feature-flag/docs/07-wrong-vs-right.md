# WRONG vs RIGHT: Feature Flag

## Rollout Consistency

### WRONG: Random Assignment

```typescript
if (flag.rolloutPercentage > 0) {
  const randomValue = Math.random() * 100;
  return randomValue <= flag.rolloutPercentage;
}
```

**Why it's wrong**: Same user gets different results on every request. This breaks:
- User experience consistency
- A/B test validity
- Cache coherency
- Analytics accuracy

### RIGHT: Consistent Hashing

```typescript
function getUserHash(userId: string, flagName: string): number {
  const hash = createHash('sha256')
    .update(`${userId}:${flagName}`)
    .digest('hex');
  return parseInt(hash.slice(0, 8), 16);
}

const value = (getUserHash(userId, flag.name) % 10000) / 100;
return value <= flag.rolloutPercentage;
```

**Why it's right**: Same user always gets the same result. Deterministic and testable.

---

## Persistence

### WRONG: In-Memory Only

```typescript
private flags: Map<string, FeatureFlag> = new Map();
// Flags reset on every restart!
```

**Why it's wrong**: Flags reset on deploy/restart. Gradual rollouts restart from 0. No audit trail.

### RIGHT: Persistent Storage

```typescript
async save(): Promise<void> {
  await fs.writeFile(
    this.configPath,
    JSON.stringify(Array.from(this.flags.values()))
  );
}

async load(): Promise<void> {
  const data = await fs.readFile(this.configPath, 'utf-8');
  const flags = JSON.parse(data);
  // Restore flags
}
```

**Why it's right**: Flags survive restarts and can be audited.

---

## Percentage Calculation

### WRONG: Integer Modulo Only

```typescript
const hash = getUserHash(userId, flagName);
return (hash % 100) <= flag.rolloutPercentage;
```

**Why it's wrong**: With 1% rollout, hash % 100 gives values 0-99. Value 0 is 1/100 = 1%. But with integer hash, precision is limited.

### RIGHT: High Precision

```typescript
const hash = getUserHash(userId, flagName);
const percentage = (hash % 10000) / 100; // 0.00 - 99.99
return percentage <= flag.rolloutPercentage;
```

**Why it's right**: Supports 0.01% precision for large user bases.

---

## Evaluation Performance

### WRONG: Compute Hash Every Time

```typescript
// No caching - computes SHA-256 on every request
```

**Why it's wrong**: SHA-256 is fast but unnecessary overhead for high-traffic systems.

### RIGHT: Cache Per Request

```typescript
// Cache in request context or Redis
const cacheKey = `${flagName}:${userId}`;
if (this.cache.has(cacheKey)) {
  return this.cache.get(cacheKey)!;
}
```

**Why it's right**: Reduces CPU usage and improves latency.
