# OLD vs NEW: Feature Flag

## Pattern 1: Environment Variables (2015)

### Old Code

```typescript
// config.ts (2015)
export const FEATURES = {
  NEW_CHECKOUT: process.env.ENABLE_NEW_CHECKOUT === 'true',
  DARK_MODE: process.env.ENABLE_DARK_MODE === 'true',
};

// checkout.ts
import { FEATURES } from './config';

function renderCheckout() {
  if (FEATURES.NEW_CHECKOUT) {
    return newCheckoutUI();
  } else {
    return oldCheckoutUI();
  }
}
```

**Why it was done:** Simple. Environment variables are the standard way to configure applications.

**Why it's wrong now:**
- Requires redeployment to change
- All-or-nothing (can't do 10% rollout)
- No per-user control
- No A/B testing
- Configuration drift across environments

### New Code (2025)

```typescript
// checkout.ts (2025)
import { flags } from './feature-flag-client';

function renderCheckout(userId: string) {
  if (flags.isEnabled('new-checkout', userId)) {
    return newCheckoutUI();
  } else {
    return oldCheckoutUI();
  }
}
```

**Why it's better:**
- Change rollout percentage instantly via API
- Gradual rollouts without deployment
- Per-user overrides for testing
- Supports A/B testing with analytics integration

---

## Pattern 2: Database Feature Toggles (2017)

### Old Code

```typescript
// 2017: Flags in SQL database
async function isFeatureEnabled(flagName: string): Promise<boolean> {
  const row = await db.query(
    'SELECT enabled FROM feature_flags WHERE name = ?',
    [flagName]
  );
  return row?.enabled ?? false;
}
```

**Why it was done:** Better than env vars. Can change without deploy. Database is the source of truth.

**Why it's wrong now:**
- DB query on every request = latency
- No percentage rollouts (just boolean)
- No consistent user hashing
- DB becomes a bottleneck
- No caching strategy

### New Code (2025)

```typescript
// 2025: In-memory evaluation with rule engine
class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private cache: LRUCache<string, boolean> = new LRUCache({ max: 10000 });

  isEnabled(flagName: string, userId?: string): boolean {
    const cacheKey = `${flagName}:${userId ?? 'anon'}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const result = this.evaluate(flagName, userId);
    this.cache.set(cacheKey, result);
    return result;
  }

  private evaluate(flagName: string, userId?: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag || !flag.enabled) return false;
    if (userId && flag.userIds?.includes(userId)) return true;
    if (flag.rolloutPercentage > 0 && userId) {
      const hash = getUserHash(userId, flagName);
      return (hash % 10000) / 100 <= flag.rolloutPercentage;
    }
    return true;
  }
}
```

**Why it's better:**
- O(1) evaluation with caching
- Percentage rollouts with consistent hashing
- No database dependency in hot path
- Can sync from external source periodically

---

## Pattern 3: Hardcoded User Lists (2016-2019)

### Old Code

```typescript
// 2018: Hardcoded beta users
const BETA_USERS = [
  'alice@example.com',
  'bob@example.com',
  'charlie@example.com',
  // ... hundreds more
];

function showNewFeature(user: User): boolean {
  return BETA_USERS.includes(user.email);
}
```

**Why it was done:** Quick way to give specific users access. Simple to understand.

**Why it's wrong now:**
- Requires code changes to add/remove users
- Lists grow unbounded
- Can't do percentage rollouts
- Merge conflicts when multiple teams edit
- No analytics integration

### New Code (2025)

```typescript
// 2025: Dynamic flag service with API management
const service = new FeatureFlagService();

// Admin adds user via API (no deploy)
await fetch('/flags/new-feature', {
  method: 'POST',
  body: JSON.stringify({
    enabled: true,
    rolloutPercentage: 10,
    userIds: ['alice@example.com', 'bob@example.com'],
  }),
});

// Application code
function showNewFeature(user: User): boolean {
  return service.isEnabled('new-feature', user.id);
}
```

**Why it's better:**
- No code changes for user management
- Combines lists with percentage rollouts
- Audit trail via API logs
- Supports automated cleanup (flag expiry)

---

## Pattern 4: Server-Side Only vs Edge Evaluation (2020 vs 2025)

### Old Approach: Server-Side Evaluation (2015-2020)

Every request hits the feature flag service API.

```typescript
// 2018: Server-side evaluation on every request
const flagState = await fetch(
  `https://flags.company.com/api/flags/dark-mode?userId=${userId}`
);
```

**Latency impact:** +50-200ms per request

### New Approach: Edge/Client-Side Evaluation (2025)

```javascript
// 2025: LaunchDarkly client-side SDK
import * as ld from 'launchdarkly-js-client-sdk';

const client = ld.initialize('sdk-key', { key: userId });
const showDarkMode = client.variation('dark-mode', false);
```

**How it works:**
1. SDK downloads all flag rules on initialization (~10KB)
2. Evaluation happens locally in the browser/edge worker
3. Zero latency per flag check
4. Streaming updates when flags change

**Why it's better:**
- Sub-millisecond evaluation
- Works offline
- Reduces server load
- Better for edge computing (Cloudflare Workers, Vercel Edge)

**Trade-off:** Flag rules are visible to client (security consideration for sensitive flags).
