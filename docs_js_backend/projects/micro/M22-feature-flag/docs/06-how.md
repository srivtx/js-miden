# HOW: Feature Flag

## Implementation Steps

### Step 1: Define the Flag Model

```typescript
interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  userIds?: string[];
}
```

### Step 2: Implement Consistent Hashing

```typescript
import { createHash } from 'crypto';

function getUserHash(userId: string, flagName: string): number {
  const hash = createHash('sha256')
    .update(`${userId}:${flagName}`)
    .digest('hex');
  return parseInt(hash.slice(0, 8), 16);
}

function isEnabledForUser(
  flag: FeatureFlag,
  userId: string
): boolean {
  const hash = getUserHash(userId, flag.name);
  const percentage = (hash % 10000) / 100; // 0-100 with 2 decimals
  return percentage <= flag.rolloutPercentage;
}
```

### Step 3: Implement Evaluation Logic

```typescript
isEnabled(flagName: string, userId?: string): boolean {
  const flag = this.flags.get(flagName);
  if (!flag) return false;
  if (!flag.enabled) return false;

  // User-specific override
  if (userId && flag.userIds?.includes(userId)) {
    return true;
  }

  // Consistent hashing for percentage rollout
  if (flag.rolloutPercentage > 0 && userId) {
    return isEnabledForUser(flag, userId);
  }

  return flag.rolloutPercentage === 100;
}
```

### Step 4: Add Persistence

```typescript
async save(): Promise<void> {
  const flags = Array.from(this.flags.values());
  await fs.writeFile(
    this.configPath,
    JSON.stringify(flags, null, 2)
  );
}

async load(): Promise<void> {
  const data = await fs.readFile(this.configPath, 'utf-8');
  const flags: FeatureFlag[] = JSON.parse(data);
  for (const flag of flags) {
    this.flags.set(flag.name, flag);
  }
}
```

### Step 5: Cache for Performance

```typescript
private cache: Map<string, boolean> = new Map();

isEnabled(flagName: string, userId?: string): boolean {
  const cacheKey = `${flagName}:${userId || ''}`;
  if (this.cache.has(cacheKey)) {
    return this.cache.get(cacheKey)!;
  }

  const result = this.evaluate(flagName, userId);
  this.cache.set(cacheKey, result);
  return result;
}
```

## Rollout Strategy

1. **Internal Testing**: 0%, enable for team only
2. **Dogfooding**: 5%, company employees
3. **Beta**: 10%, volunteer users
4. **Gradual**: 25% → 50% → 75% → 100%
5. **Full Release**: 100%

## Best Practices

- Always check if flag exists before evaluating
- Use consistent hashing for deterministic results
- Cache evaluations per request
- Log flag decisions for debugging
- Remove old flags after full rollout
