# CONCEPTS: Feature Flag

## Concept 1: Consistent Hashing

### WHAT

Consistent hashing is a technique that maps data to a fixed point in a hash space such that the same input always produces the same output, while different inputs are distributed uniformly.

### WHY

For feature flags, we need the same user to always fall into the same "bucket" (enabled or disabled). Random assignment invalidates experiments and confuses users.

### HOW

```typescript
import { createHash } from 'crypto';

function getUserHash(userId: string, flagName: string): number {
  // Combine userId and flagName so the same user
  // gets different assignments for different flags
  const input = `${userId}:${flagName}`;
  const hash = createHash('sha256').update(input).digest('hex');
  
  // Take first 8 hex chars (32 bits) and convert to integer
  return parseInt(hash.slice(0, 8), 16);
}

function isUserInRollout(
  userId: string,
  flagName: string,
  rolloutPercentage: number
): boolean {
  const hash = getUserHash(userId, flagName);
  const value = (hash % 10000) / 100; // 0.00 to 99.99
  return value <= rolloutPercentage;
}
```

### WRONG vs RIGHT

**WRONG: Math.random() per request**
```typescript
// Same user gets different results every time!
return Math.random() * 100 <= rolloutPercentage;
```

**RIGHT: Deterministic hash**
```typescript
// Same user always gets same result
const hash = getUserHash(userId, flagName);
return (hash % 10000) / 100 <= rolloutPercentage;
```

---

## Concept 2: Feature Flag Lifecycle

### WHAT

Feature flags progress through states: development → internal testing → gradual rollout → general availability → removal.

### WHY

Flags are temporary. Leaving flags in code forever creates technical debt ("flag sprawl").

### HOW

```
1. DEVELOPMENT (0%, dev team only)
   Code is deployed but hidden
   
2. INTERNAL TESTING (100%, employees only)
   Dogfooding with real data
   
3. CANARY (1-5%, real users)
   Monitor error rates, performance
   
4. GRADUAL ROLLOUT (10% → 50% → 100%)
   Expand based on metrics
   
5. GENERAL AVAILABILITY (100%, everyone)
   Feature is stable
   
6. REMOVAL
   Delete flag, clean up code
```

### WRONG vs RIGHT

**WRONG: Flag stays forever**
```typescript
// 3 years later, flag still exists
if (flags.isEnabled('new-checkout-2022')) {
  // ...
}
```

**RIGHT: Flag with removal date**
```typescript
// LaunchDarkly and Unleash both support expiration dates
// Automated alerts when flags exceed their expected lifetime
```

---

## Concept 3: A/B Testing vs Feature Flags

### WHAT

- **Feature Flag**: Is this feature available? (Boolean)
- **A/B Test**: Does variant A or B perform better? (Controlled experiment)

### WHY

They are related but distinct. All A/B tests use feature flags, but not all feature flags are A/B tests.

### HOW

```typescript
// Feature Flag: Should we show the new button?
const showNewButton = flags.isEnabled('new-button', userId);

// A/B Test: Does green or blue button convert better?
const buttonColor = flags.getVariant('button-color-test', userId, ['green', 'blue']);
```

### WRONG vs RIGHT

**WRONG: Using a feature flag for an A/B test without tracking**
```typescript
if (flags.isEnabled('green-button', userId)) {
  showGreenButton();
} else {
  showBlueButton();
}
// No analytics = no experiment
```

**RIGHT: Explicit experiment tracking**
```typescript
const variant = flags.getVariant('button-color-test', userId, ['green', 'blue']);
analytics.track('experiment_viewed', {
  experiment_id: 'button-color-test',
  variant,
});
showButton(variant);
```

---

## Concept 4: Override Hierarchy

### WHAT

When multiple rules could apply to a user, which one wins?

### WHY

Clear precedence prevents ambiguity and surprise.

### HOW

```
Priority (highest to lowest):

1. DISABLED flag
   → Return false for everyone
   
2. User-specific NEGATIVE override
   → Return false for this user
   
3. User-specific POSITIVE override
   → Return true for this user
   
4. Percentage rollout
   → Hash-based deterministic assignment
   
5. Default
   → Return false
```

### WRONG vs RIGHT

**WRONG: Unclear precedence**
```typescript
// What if user is in override list but rollout is 0%?
// Code behavior is ambiguous
```

**RIGHT: Explicit priority chain**
```typescript
isEnabled(flagName, userId): boolean {
  const flag = this.flags.get(flagName);
  if (!flag) return false;           // Missing = false
  if (!flag.enabled) return false;   // Disabled = false
  if (flag.disabledUserIds?.includes(userId)) return false;
  if (flag.enabledUserIds?.includes(userId)) return true;
  if (flag.rolloutPercentage > 0 && userId) {
    return hashBasedRollout(userId, flagName, flag.rolloutPercentage);
  }
  return true; // Flag is enabled, no rollout, no override
}
```
