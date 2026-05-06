# DECISIONS: Feature Flag

## Decision 1: Random vs Consistent Hashing for Rollout

### Option A: Math.random() (The Bug)

```typescript
if (flag.rolloutPercentage > 0) {
  const randomValue = Math.random() * 100;
  return randomValue <= flag.rolloutPercentage;
}
```

**Pros:**
- Simple, no imports needed
- Perfectly uniform distribution

**Cons:**
- Non-deterministic per request
- Breaks A/B testing
- Breaks user experience consistency
- Invalidates caching strategies

**What if wrong?** Every request from the same user could show a different UI. A/B tests produce garbage data. Product decisions based on invalid experiments cost millions.

### Option B: Consistent Hashing (What We Chose as Correct)

```typescript
import { createHash } from 'crypto';

function getUserHash(userId: string, flagName: string): number {
  const hash = createHash('sha256')
    .update(`${userId}:${flagName}`)
    .digest('hex');
  return parseInt(hash.slice(0, 8), 16);
}

// In isEnabled():
if (flag.rolloutPercentage > 0 && userId) {
  const hash = getUserHash(userId, flagName);
  const value = (hash % 10000) / 100;
  return value <= flag.rolloutPercentage;
}
```

**Pros:**
- Same user + flag = same result, forever
- Uniform distribution (SHA-256 properties)
- Works across requests, sessions, servers

**Cons:**
- Slightly more CPU (SHA-256)
- Requires userId to be present

**Why we chose B:** Determinism is the #1 requirement for feature flags. The slight CPU cost is irrelevant compared to the business value of valid experiments.

---

## Decision 2: In-Memory Map vs Database vs Redis

### Option A: In-Memory Map (What We Chose)

```typescript
private flags: Map<string, FeatureFlag> = new Map();
```

**Pros:**
- Zero latency
- Zero infrastructure
- Simple

**Cons:**
- Lost on restart
- Not shared across instances
- No audit trail

### Option B: JSON File Persistence

```typescript
async save(): Promise<void> {
  await fs.writeFile('./flags.json', JSON.stringify([...this.flags]));
}
```

**Pros:**
- Survives restarts
- Simple file-based

**Cons:**
- File locking issues
- No concurrent access
- Slow writes

### Option C: Redis

```typescript
await redis.hset('flags', name, JSON.stringify(flag));
```

**Pros:**
- Shared across instances
- Fast
- TTL support

**Cons:**
- Infrastructure dependency
- Network latency

**Why we chose A:** Micro-project scope. Production systems use C (Redis) or specialized services (LaunchDarkly, Unleash).

---

## Decision 3: Override Priority Rules

### Option A: Override Wins (What We Chose)

```typescript
if (userId && flag.userIds?.includes(userId)) {
  return true; // Override always enables
}
```

**Pros:**
- Simple to understand
- Admins always get access

**Cons:**
- Can't force-disable specific users
- No negative overrides

### Option B: Explicit Override State

```typescript
interface FeatureFlag {
  // ...
  enabledUserIds?: string[];
  disabledUserIds?: string[];
}
```

**Pros:**
- Can force-enable OR force-disable
- More flexible

**Cons:**
- More complex UI and API
- Potential conflicts (user in both lists)

**Why we chose A:** Simplicity. For a micro-project, positive overrides cover 90% of use cases. Negative overrides can be added later.

---

## Decision 4: SHA-256 vs Simple Hash

### Option A: SHA-256 (What We Chose)

```typescript
const hash = createHash('sha256').update(`${userId}:${flagName}`).digest('hex');
```

**Pros:**
- Cryptographically uniform
- Avalanche effect (small input change = completely different output)
- Standard, well-tested

**Cons:**
- Slightly slower than simple hash
- Node.js crypto module import

### Option B: DJB2 or FNV-1a

```typescript
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return hash;
}
```

**Pros:**
- Much faster
- Simple implementation

**Cons:**
- Less uniform distribution
- More collisions for certain input patterns

**Why we chose A:** For feature flags, uniformity matters more than speed. SHA-256 at ~50,000 ops/sec is more than sufficient. If evaluating millions of flags per second, switch to FNV-1a or xxHash.
