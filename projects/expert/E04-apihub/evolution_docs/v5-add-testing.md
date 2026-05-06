# v5 — Add Testing

Your API marketplace has logging, but billing miscalculations reach production. A rate limit bypass is discovered by a developer. Cross-service auth breaks silently. You need a safety net.

## Pain #1: Billing Calculation Errors

You refactor the invoice calculator to support annual discounts. The change works for monthly billing but applies the discount twice for annual plans. A developer is charged $0 instead of $500. You only find out when they report it.

## Pain #2: Rate Limit Race Conditions

You optimize rate limiting for better throughput. The new code uses an in-memory counter without atomic operations. Two concurrent requests both see count=99, both increment to 100, both pass. The limit of 100 is exceeded to 101. A developer abuses it.

## Pain #3: Cross-Developer API Key Leaks

You add API key caching for performance. The cache key is only the key string, not the developer ID. Developer A's cached key validation allows Developer B to use A's key. APIs are accessed without proper attribution.

## The Fix: Layered Testing Strategy

### Unit Tests: Billing Calculations

```typescript
// tests/unit/billing.test.ts
import { describe, it, expect } from 'vitest';
import { calculateInvoice } from '../../services/billing/src/routes/invoices.js';

describe('Invoice calculations', () => {
  it('should calculate base amount correctly', () => {
    const invoice = calculateInvoice({
      apiKeyId: 'key_1',
      apiId: 'api_1',
      tierId: 'pro',
      totalRequests: 5000,
    });
    
    expect(invoice.baseAmount).toBe(49); // Pro tier
    expect(invoice.overageAmount).toBe(0);
    expect(invoice.totalAmount).toBe(49);
  });
  
  it('should calculate overages correctly', () => {
    const invoice = calculateInvoice({
      apiKeyId: 'key_1',
      apiId: 'api_1',
      tierId: 'pro',
      totalRequests: 15000, // 5000 over limit
    });
    
    expect(invoice.baseAmount).toBe(49);
    expect(invoice.overageAmount).toBe(5000 * 0.001); // $0.001 per request
    expect(invoice.totalAmount).toBe(49 + 5);
  });
  
  it('should handle zero requests', () => {
    const invoice = calculateInvoice({
      apiKeyId: 'key_1',
      apiId: 'api_1',
      tierId: 'pro',
      totalRequests: 0,
    });
    
    expect(invoice.totalAmount).toBe(49);
  });
  
  it('should reject negative requests', () => {
    expect(() => calculateInvoice({
      apiKeyId: 'key_1',
      apiId: 'api_1',
      tierId: 'pro',
      totalRequests: -100,
    })).toThrow();
  });
});
```

### Unit Tests: Rate Limiting

```typescript
// tests/unit/ratelimit.test.ts
import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '../../services/gateway/src/middleware/ratelimit.js';

describe('Rate limiting', () => {
  it('should allow requests under the limit', async () => {
    const result = await checkRateLimit('key_1', 100);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });
  
  it('should block requests over the limit', async () => {
    // Exhaust the limit
    for (let i = 0; i < 100; i++) {
      await checkRateLimit('key_1', 100);
    }
    
    const result = await checkRateLimit('key_1', 100);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
  
  it('should reset after window expires', async () => {
    // Exhaust limit
    for (let i = 0; i < 100; i++) {
      await checkRateLimit('key_2', 100);
    }
    
    // Wait for window to expire (simulated)
    await advanceTime(1001);
    
    const result = await checkRateLimit('key_2', 100);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });
  
  it('should track different keys independently', async () => {
    await checkRateLimit('key_A', 10);
    await checkRateLimit('key_A', 10);
    
    const resultB = await checkRateLimit('key_B', 10);
    expect(resultB.remaining).toBe(9); // Not affected by key_A
  });
});
```

### Integration Tests: Gateway Auth Flow

```typescript
// tests/integration/gateway-auth.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestGateway } from '../helpers/test-gateway.js';

let gateway: any;

describe('Gateway authentication', () => {
  beforeAll(async () => {
    gateway = await setupTestGateway();
  });
  
  it('should reject requests without API key', async () => {
    const response = await gateway.get('/proxy/api_1/v1/users');
    expect(response.status).toBe(401);
  });
  
  it('should reject invalid API keys', async () => {
    const response = await gateway
      .get('/proxy/api_1/v1/users')
      .set('X-API-Key', 'invalid-key');
    expect(response.status).toBe(401);
  });
  
  it('should allow valid API keys', async () => {
    const apiKey = await gateway.createApiKey('dev_1', 'api_1');
    const response = await gateway
      .get('/proxy/api_1/v1/users')
      .set('X-API-Key', apiKey);
    expect(response.status).toBe(200);
  });
  
  it('should enforce rate limits per key', async () => {
    const apiKey = await gateway.createApiKey('dev_1', 'api_1', { limit: 5 });
    
    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      const res = await gateway.get('/proxy/api_1/v1/users').set('X-API-Key', apiKey);
      expect(res.status).toBe(200);
    }
    
    // 6th request should be rate limited
    const blocked = await gateway.get('/proxy/api_1/v1/users').set('X-API-Key', apiKey);
    expect(blocked.status).toBe(429);
  });
  
  it('should NOT allow cross-developer key usage', async () => {
    const dev1Key = await gateway.createApiKey('dev_1', 'api_1');
    
    // dev_2 tries to use dev_1's key
    const response = await gateway
      .get('/proxy/api_1/v1/users')
      .set('X-API-Key', dev1Key)
      .set('X-Developer-Id', 'dev_2');
    
    expect(response.status).toBe(403);
  });
});
```

### Integration Tests: Usage Aggregation

```typescript
// tests/integration/usage.test.ts
import { describe, it, expect } from 'vitest';
import { UsageTracker } from '../../services/usage/src/routes/tracking.js';

describe('Usage tracking', () => {
  it('should aggregate usage atomically', async () => {
    const tracker = new UsageTracker();
    const apiKeyId = 'key_1';
    
    // Simulate 100 concurrent requests
    const requests = Array.from({ length: 100 }, () =>
      tracker.record(apiKeyId, { statusCode: 200, latencyMs: 50 })
    );
    await Promise.all(requests);
    
    const usage = await tracker.getUsage(apiKeyId);
    expect(usage.totalRequests).toBe(100);
    expect(usage.successfulRequests).toBe(100);
  });
  
  it('should calculate quotas correctly', async () => {
    const tracker = new UsageTracker();
    const apiKeyId = 'key_1';
    
    await tracker.record(apiKeyId, { statusCode: 200 });
    await tracker.record(apiKeyId, { statusCode: 200 });
    await tracker.record(apiKeyId, { statusCode: 500 });
    
    const quota = await tracker.checkQuota(apiKeyId, 100);
    expect(quota.used).toBe(3);
    expect(quota.remaining).toBe(97);
  });
});
```

## What Changed

1. **Billing accuracy** — Every calculation path is tested: base, overage, zero, negative.
2. **Rate limit integrity** — Window reset, key isolation, and blocking are verified.
3. **Auth security** — Cross-developer key usage is explicitly rejected.
4. **Usage correctness** — Concurrent aggregation and quota tracking are tested.

## Testing as Revenue Protection

In a marketplace, billing errors are existential threats. A test that verifies `$49 + $5 = $54` is not trivial — it's the difference between a trusted platform and a refund nightmare. Rate limit tests prevent abuse. Auth tests prevent data leaks. These are business-critical, not nice-to-have.

## Next Pain

Tests run but imports use `require()` and the shared types package is awkward. You need ESM for cleaner cross-service imports and tree shaking.
