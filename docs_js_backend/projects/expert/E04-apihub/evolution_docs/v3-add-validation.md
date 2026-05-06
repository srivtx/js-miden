# v3 — Add Validation

Your API marketplace has six services accepting JSON from external developers. Without validation, one malformed request can corrupt billing, bypass rate limits, or crash the gateway.

## Pain #1: Billing Data Corruption

```typescript
// billing/src/routes/invoices.ts
router.post('/calculate', (req, res) => {
  const { apiKeyId, apiId, tierId, totalRequests } = req.body;
  const tier = tiers.get(tierId);
  // tier might be undefined. totalRequests might be a string.
  const overageRequests = Math.max(0, totalRequests - tier.requestsPerMonth);
  // NaN if totalRequests is 'one_million'
});
```

A developer sends `totalRequests: "1000000"`. Subtraction gives `NaN`. The invoice total is `NaN`. The payment processor rejects it. The developer is billed $0.

## Pain #2: Rate Limit Bypass

```typescript
// gateway/src/middleware/ratelimit.ts
export async function checkRateLimit(apiKeyId, tierLimitPerSecond) {
  // apiKeyId might be an object. tierLimitPerSecond might be undefined.
  const key = `${apiKeyId}:${Math.floor(now / windowMs)}`;
  // key becomes '[object Object]:12345'
}
```

An attacker sends `apiKeyId: { toString: () => 'shared-key' }`. All requests share one rate limit bucket. The attacker exhausts the shared quota for all users.

## Pain #3: API Registration Abuse

```typescript
// developer-portal/src/routes/apis.ts
router.post('/apis', (req, res) => {
  const api = { id: generateId(), ...req.body };
  // req.body might contain baseUrl: 'ftp://attacker.com'
  // Or baseUrl: 'http://localhost:22'
  apis.set(api.id, api);
});
```

A developer registers an API with `baseUrl: 'http://169.254.169.254/latest/meta-data/'`. The gateway proxies internal AWS metadata. IAM credentials leak.

## The Fix: Zod at Every Service Boundary

```typescript
// shared/src/validation/gateway.ts
import { z } from 'zod';

export const ProxyRequestSchema = z.object({
  apiKey: z.string().min(32).max(256),
  endpoint: z.string().min(1).max(2048),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET'),
});

export const ApiRegistrationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  baseUrl: z.string().url().refine(
    (url) => {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    },
    { message: 'URL must use HTTP or HTTPS' }
  ),
});

export const InvoiceCalculationSchema = z.object({
  apiKeyId: z.string().min(1),
  apiId: z.string().min(1),
  tierId: z.string().min(1),
  totalRequests: z.number().int().min(0),
});

export const RateLimitCheckSchema = z.object({
  apiKeyId: z.string().min(1),
  tierLimitPerSecond: z.number().int().min(1).max(100000),
});
```

```typescript
// gateway/src/middleware/ratelimit.ts
import { RateLimitCheckSchema } from '@shared/validation/gateway.js';

export async function checkRateLimit(
  apiKeyId: string,
  tierLimitPerSecond: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const validated = RateLimitCheckSchema.parse({ apiKeyId, tierLimitPerSecond });
  // Now guaranteed: apiKeyId is string, tierLimitPerSecond is number 1-100000
  const key = `${validated.apiKeyId}:${Math.floor(Date.now() / 1000)}`;
  // ...
}
```

```typescript
// developer-portal/src/routes/apis.ts
import { ApiRegistrationSchema } from '@shared/validation/gateway.js';

router.post('/apis', authenticate, validateBody(ApiRegistrationSchema), (req, res) => {
  const { name, description, baseUrl } = req.body;
  // baseUrl is guaranteed to be a valid HTTP(S) URL
  const api: API = { id: generateId(), name, description, baseUrl, ownerId: req.user.id, status: 'active', createdAt: new Date() };
  apis.set(api.id, api);
  res.status(201).json(api);
});
```

## What Changed

1. **Billing accuracy** — `totalRequests` must be a non-negative integer. No NaN invoices.
2. **Rate limit integrity** — `apiKeyId` is a string. No object injection.
3. **SSRF prevention** — `baseUrl` must be HTTP(S). No file://, ftp://, or internal IPs.
4. **Cross-service consistency** — shared validation schemas for all services.

## Validation as Revenue Protection

In a marketplace, billing errors are existential. Under-charging destroys revenue. Over-charging destroys trust. Validation ensures every invoice is mathematically sound.

## Next Pain

When the billing service miscalculates, you have no audit trail. `console.log` output is lost on restart. You need structured logging.
