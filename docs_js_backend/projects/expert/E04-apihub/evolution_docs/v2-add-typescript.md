# v2 — Add TypeScript

Your API marketplace has six microservices. Each has its own data shapes. Type mismatches between gateway, auth, billing, and analytics are causing silent failures.

## Pain #1: Gateway Proxy Type Confusion

```js
// gateway/src/routes/proxy.js
app.all('/proxy/:apiId/*', async (req, res) => {
  const api = await serviceClient.getApi(req.params.apiId);
  const targetUrl = `${api.baseUrl}${req.params[0]}`;
  // api.baseUrl might be undefined. targetUrl becomes 'undefined/v1/users'.
});
```

The gateway proxies to `undefined/v1/users`. The request fails with `ENOTFOUND`. The developer sees a 500. You have no idea why.

## Pain #2: Billing Invoice Shape Mismatch

```js
// billing/src/routes/invoices.js
const invoice = {
  id: generateId('inv'),
  apiKeyId,
  developerId: req.body.developerId,
  apiId,
  tierId,
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  baseAmount,
  overageAmount,
  totalAmount,
  status: 'pending',
  createdAt: now,
};
```

The analytics service expects `invoice.total` not `invoice.totalAmount`. Dashboards show `$0` for all invoices. Finance thinks the platform made no money.

## Pain #3: Rate Limit State Corruption

```js
// gateway/src/middleware/ratelimit.js
const entry = rateLimitStore.get(key);
entry.count++; // entry might be undefined
```

An undefined entry causes a crash. The gateway restarts. All in-flight requests are dropped.

## The Fix: TypeScript

```ts
// shared/src/types/index.ts
export interface API {
  id: string;
  name: string;
  baseUrl: string;
  ownerId: string;
  status: 'active' | 'deprecated' | 'removed';
  createdAt: Date;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  requestsPerMonth: number;
  pricePerMonth: number;
  overagePricePerRequest: number;
}

export interface Invoice {
  id: string;
  apiKeyId: string;
  developerId: string;
  apiId: string;
  tierId: string;
  year: number;
  month: number;
  baseAmount: number;
  overageAmount: number;
  totalAmount: number;
  status: 'pending' | 'paid' | 'failed';
  createdAt: Date;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface UsageMetric {
  apiKeyId: string;
  apiId: string;
  timestamp: number;
  statusCode: number;
  latencyMs: number;
}
```

```ts
// gateway/src/middleware/ratelimit.ts
import { RateLimitEntry } from '@shared/types/index.js';

const rateLimitStore = new Map<string, RateLimitEntry>();

export async function checkRateLimit(
  apiKeyId: string,
  tierLimitPerSecond: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now = Date.now();
  const windowMs = 1000;
  const key = `${apiKeyId}:${Math.floor(now / windowMs)}`;

  let entry = rateLimitStore.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
  }

  entry.count++;

  const allowed = entry.count <= tierLimitPerSecond;
  const remaining = Math.max(0, tierLimitPerSecond - entry.count);

  return { allowed, remaining, resetAt: new Date(entry.resetAt) };
}
```

## What Changed

1. **Cross-service contracts** — one shared type package for all services
2. **Null safety** — `api.baseUrl` is `string`, not `string | undefined`
3. **Rate limit correctness** — `entry` is guaranteed to exist before incrementing
4. **Invoice integrity** — every field is typed. Analytics can't miss `totalAmount`.

## Trade-Offs

- **Shared package complexity** — you need a monorepo or published types package
- **Build coordination** — changes to shared types require rebuilding all services
- **Docker builds** — shared types must be copied into every service image

## Migration Path

```bash
# 1. Create shared types package
mkdir shared/src/types
# Define API, SubscriptionTier, Invoice, UsageMetric, RateLimitEntry

# 2. Update each service's tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["../../shared/src/*"]
    }
  }
}

# 3. Type the gateway first (most cross-service touchpoints)
# Then auth, billing, usage, analytics, developer-portal
```

## Result

Cross-service data mismatches are caught at compile time. Refactoring an invoice field updates analytics, billing, and developer portal automatically. Gateway crashes from undefined values drop to zero.
