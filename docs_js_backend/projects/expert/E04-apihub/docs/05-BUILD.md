# E04 API Hub: Build Guide

## Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Basic understanding of microservices and API design

## Step 1: Project Setup

```bash
mkdir api-hub && cd api-hub
npm init -y
npm install express jsonwebtoken
npm install -D typescript vitest supertest @types/express @types/node
npx tsc --init
```

## Step 2: Shared Types

Create `shared/src/types/index.ts`:
```typescript
export interface ApiKey {
  id: string;
  key: string;
  developerId: string;
  apiId: string;
  tierId: string;
  status: 'active' | 'revoked' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}

export interface UsageAggregate {
  apiKeyId: string;
  apiId: string;
  year: number;
  month: number;
  totalRequests: number;
  totalResponseTimeMs: number;
  errorCount: number;
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
  status: 'pending' | 'paid';
  createdAt: Date;
}
```

## Step 3: Gateway Proxy (CORRECT)

Create `services/gateway/src/routes/proxy.ts`:
```typescript
import { Router } from 'express';
import { validateApiKey } from '../middleware/auth.js';

const router = Router();
const targetApis = new Map<string, { baseUrl: string; developerId: string }>();

router.all('/:apiId/*', validateApiKey, async (req, res) => {
  const apiKeyContext = (req as any).apiKeyContext;
  const apiId = req.params.apiId;
  const targetApi = targetApis.get(apiId);

  if (!targetApi) {
    return res.status(404).json({ error: 'API not found' });
  }

  // CRITICAL: Cross-developer authorization check
  const isOwner = apiKeyContext.developerId === targetApi.developerId;
  const hasSubscription = await checkSubscription(apiKeyContext.apiKeyId, apiId);

  if (!isOwner && !hasSubscription) {
    return res.status(403).json({
      error: 'Not authorized',
      detail: 'Your API key does not have access to this API',
    });
  }

  // Rate limit check
  const rateLimitResult = await checkRateLimit(apiKeyContext.apiKeyId, 10);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // Proxy request
  const startTime = Date.now();
  // ... proxy logic ...
  const responseTime = Date.now() - startTime;

  // Record usage with correct developerId
  await usageClient.post('/track', {
    apiKeyId: apiKeyContext.apiKeyId,
    apiId,
    developerId: apiKeyContext.developerId, // ← CORRECT: Use key's developer, not target's
    endpoint: req.params[0],
    method: req.method,
    statusCode: 200,
    responseTimeMs: responseTime,
  });

  res.json({ proxied: true, apiId, responseTimeMs: responseTime });
});

export { targetApis };
export default router;
```

## Step 4: Usage Tracking (CORRECT)

Create `services/usage/src/routes/tracking.ts`:
```typescript
import { Router } from 'express';

const router = Router();
const aggregates = new Map<string, any>();

// CORRECT: Atomic increment simulation with a single Map update
// In production, use PostgreSQL UPSERT or Redis INCR
router.post('/', async (req, res) => {
  const { apiKeyId, apiId, developerId, endpoint, method, statusCode, responseTimeMs } = req.body;

  const now = new Date();
  const aggregateKey = `${apiKeyId}:${apiId}:${now.getFullYear()}-${now.getMonth() + 1}`;

  // Simulate atomic operation
  const current = aggregates.get(aggregateKey);
  if (!current) {
    aggregates.set(aggregateKey, {
      apiKeyId, apiId, year: now.getFullYear(), month: now.getMonth() + 1,
      totalRequests: 1, totalResponseTimeMs: responseTimeMs, errorCount: statusCode >= 400 ? 1 : 0,
    });
  } else {
    // In production: use UPDATE ... SET total_requests = total_requests + 1
    current.totalRequests += 1;
    current.totalResponseTimeMs += responseTimeMs;
    if (statusCode >= 400) current.errorCount += 1;
  }

  res.status(201).json({ recorded: true });
});

export { aggregates };
export default router;
```

## Step 5: Billing Service

Create `services/billing/src/routes/invoices.ts`:
```typescript
import { Router } from 'express';

const router = Router();
const invoices = new Map<string, any>();
const tiers = new Map<string, { requestsPerMonth: number; pricePerMonth: number; overagePricePerRequest: number }>();

router.post('/calculate', (req, res) => {
  const { apiKeyId, apiId, tierId, totalRequests, developerId } = req.body;

  const tier = tiers.get(tierId);
  if (!tier) {
    return res.status(404).json({ error: 'Tier not found' });
  }

  const now = new Date();
  const overageRequests = Math.max(0, totalRequests - tier.requestsPerMonth);
  const baseAmount = tier.pricePerMonth;
  const overageAmount = overageRequests * tier.overagePricePerRequest;

  const invoice = {
    id: `inv_${Date.now()}`,
    apiKeyId,
    developerId,
    apiId,
    tierId,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    baseAmount,
    overageAmount,
    totalAmount: baseAmount + overageAmount,
    status: 'pending',
    createdAt: now,
  };

  invoices.set(invoice.id, invoice);
  res.json({ invoice });
});

export { invoices, tiers };
export default router;
```

## Step 6: Testing

Create `tests/integration/cross-service.test.ts`:
```typescript
import { describe, it } from 'mocha';
import { expect } from 'chai';
import request from 'supertest';
import gatewayApp from '../../services/gateway/src/index.js';
import authApp from '../../services/auth/src/index.js';
import portalApp from '../../services/developer-portal/src/index.js';
import usageApp from '../../services/usage/src/index.js';
import { targetApis } from '../../services/gateway/src/routes/proxy.js';
import { aggregates } from '../../services/usage/src/routes/tracking.js';

describe('Integration Tests - Security Bugs', () => {
  beforeEach(() => {
    targetApis.clear();
    aggregates.clear();
  });

  it('SHOULD FAIL: Developer A key should NOT access Developer B API', async () => {
    const devARes = await request(authApp).post('/auth/register').send({ email: 'devA@test.com', name: 'Developer A' });
    const devAId = devARes.body.developer.id;

    const devBRes = await request(authApp).post('/auth/register').send({ email: 'devB@test.com', name: 'Developer B' });
    const devBId = devBRes.body.developer.id;

    const apiRes = await request(portalApp).post('/apis/register').send({
      developerId: devBId, name: 'Secret API', baseUrl: 'https://api.devb.com',
      routes: [{ path: '/secret', method: 'GET', description: 'Secret' }],
    });
    const apiId = apiRes.body.api.id;

    const keyRes = await request(authApp).post('/keys/create').send({ developerId: devAId, apiId: 'api_other', tierId: 'tier_free' });
    const devAKey = keyRes.body.key;

    await request(gatewayApp).post('/proxy/register-target').send({ apiId, baseUrl: 'https://api.devb.com', developerId: devBId });

    const proxyRes = await request(gatewayApp).get(`/proxy/${apiId}/secret`).set('x-api-key', devAKey);
    expect(proxyRes.status).to.equal(403);
  });
});
```

## Step 7: Run

```bash
npx vitest
```
