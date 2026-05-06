# v4 — Add Logging

Your API marketplace has 6 services handling authentication, billing, rate limiting, and proxying. When a developer reports an API key not working, you have no way to trace the request through gateway → auth → usage → billing.

## Pain #1: Gateway Errors Without Context

```typescript
// gateway/src/routes/proxy.ts (before)
app.all('/proxy/:apiId/*', async (req, res) => {
  try {
    const api = await serviceClient.getApi(req.params.apiId);
    // ...
  } catch (error) {
    console.error('Proxy error', error);
    res.status(500).json({ error: 'Proxy failed' });
  }
});
```

A developer gets 500 on every request. The log says `"Proxy error"` with a stack trace. You can't tell:
- Which API they were calling
- Which API key they used
- Whether auth validated the key
- Whether rate limiting rejected them
- The request duration

## Pain #2: Billing Disputes Without Audit Trail

```typescript
// billing/src/routes/invoices.ts (before)
router.post('/calculate', (req, res) => {
  console.log('Calculating invoice for', req.body.apiKeyId);
  // ...
});
```

A developer disputes a $500 overage charge. The log shows the calculation but not:
- The tier configuration at the time
- The exact request count used
- The timestamp of each request aggregation
- Which usage service instance performed the aggregation

## Pain #3: Rate Limiting Without Transparency

```typescript
// gateway/src/middleware/ratelimit.ts (before)
export async function checkRateLimit(apiKeyId, tierLimitPerSecond) {
  console.log('Checking rate limit for', apiKeyId);
  // ...
}
```

A developer hits 429 Too Many Requests. They claim they made only 10 requests. The log shows the rate limit check but not:
- The exact request count in the current window
- The window boundaries
- The remaining quota
- The tier limit applied

## The Fix: Structured Logging with Request Tracing

```typescript
// shared/src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: process.env.SERVICE_NAME,
    version: process.env.SERVICE_VERSION,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['apiKey', 'apiSecret', 'password', 'req.headers.authorization'],
    remove: true,
  },
});

export function createRequestLogger(req: Request) {
  return logger.child({
    requestId: req.headers['x-request-id'] || crypto.randomUUID(),
    apiKeyId: (req as any).apiKeyId,
    developerId: (req as any).developerId,
    apiId: req.params.apiId,
    method: req.method,
    path: req.path,
  });
}
```

```typescript
// gateway/src/routes/proxy.ts
import { logger, createRequestLogger } from '@shared/utils/logger.js';

app.all('/proxy/:apiId/*', async (req, res) => {
  const log = createRequestLogger(req);
  const startTime = Date.now();
  
  log.info({ apiId: req.params.apiId, endpoint: req.params[0] }, 'Proxy request started');
  
  try {
    // 1. Validate API key
    const authResult = await authService.validateKey(req.headers['x-api-key'] as string);
    if (!authResult.valid) {
      log.warn({ reason: authResult.reason }, 'API key validation failed');
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // 2. Check rate limit
    const rateLimit = await checkRateLimit(authResult.apiKeyId, authResult.tierLimit);
    if (!rateLimit.allowed) {
      log.warn({ remaining: rateLimit.remaining }, 'Rate limit exceeded');
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    // 3. Proxy request
    const response = await forwardRequest(req, authResult);
    
    log.info({
      durationMs: Date.now() - startTime,
      statusCode: response.status,
      rateLimitRemaining: rateLimit.remaining,
    }, 'Proxy request completed');
    
    res.status(response.status).json(response.data);
  } catch (error: any) {
    log.error({ err: error, durationMs: Date.now() - startTime }, 'Proxy request failed');
    res.status(500).json({ error: 'Internal error' });
  }
});
```

```typescript
// billing/src/routes/invoices.ts
import { logger } from '@shared/utils/logger.js';

router.post('/calculate', (req, res) => {
  const log = logger.child({ apiKeyId: req.body.apiKeyId, apiId: req.body.apiId });
  log.info({ totalRequests: req.body.totalRequests, tierId: req.body.tierId }, 'Invoice calculation started');
  
  const tier = tiers.get(req.body.tierId);
  if (!tier) {
    log.error({ tierId: req.body.tierId }, 'Tier not found');
    return res.status(404).json({ error: 'Tier not found' });
  }
  
  const overageRequests = Math.max(0, req.body.totalRequests - tier.requestsPerMonth);
  const totalAmount = tier.pricePerMonth + overageRequests * tier.overagePricePerRequest;
  
  log.info({
    baseAmount: tier.pricePerMonth,
    overageAmount: overageRequests * tier.overagePricePerRequest,
    totalAmount,
    tierConfig: tier,
  }, 'Invoice calculated');
  
  // ...
});
```

## Log Output Example

```json
{
  "level": 30,
  "time": "2025-01-15T16:20:33.111Z",
  "service": "gateway",
  "version": "2.1.0",
  "requestId": "req_xyz789",
  "apiKeyId": "key_abc123",
  "developerId": "dev_456",
  "apiId": "api_weather",
  "method": "GET",
  "path": "/proxy/api_weather/v1/current",
  "durationMs": 45,
  "statusCode": 200,
  "rateLimitRemaining": 9954,
  "msg": "Proxy request completed"
}
```

## What Changed

1. **Request tracing** — `requestId` spans gateway, auth, usage, and billing.
2. **Billing transparency** — Every invoice calculation logs the full formula inputs.
3. **Rate limit clarity** — Rejected requests log the exact count and limit.
4. **Performance tracking** — Every proxy request logs duration.

## Logging as Marketplace Trust

Developers pay for API usage. When they dispute a bill or report an outage, structured logs are your only defense. "Show me the logs" is the first request in any billing dispute. Without them, you refund blindly.

## Next Pain

You fix a rate limit bug and deploy. A week later, a developer reports they're still getting 429s incorrectly. You have no regression test for rate limiting. You need automated testing.
