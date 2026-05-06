# v4 — Add Logging (Trading Engine)

## The Scenario

It's 2am. The market is open in Tokyo. Your junior stares at the console: "The last thing I see is `Trading engine running on port 3000`. Then nothing." A trader reports their order disappeared. You check the logs. There are no logs. Just console output that vanished when PM2 restarted the process.

## The PAIN: Console.log Is Not Logging

From v3:

```typescript
app.post('/orders', async (req, res, next) => {
  try {
    const parsed = createOrderSchema.parse(req.body);
    const order = await createOrder(parsed);
    console.log('Created order:', order.id); // <-- This is not logging
    res.status(201).json(order);
  } catch (err) {
    console.error('Error:', err); // <-- This is also not logging
    next(err);
  }
});
```

### What breaks in production:

1. **No persistence**: `console.log` goes to stdout. Docker swallows it. PM2 might keep it... or not. When the server restarts, logs are gone. Regulatory reporting requires 7-year retention.

2. **No context**: `"Error: [object Object]"` — you logged an Error object with console.log. The stack trace is gone. You can't debug the matching engine failure.

3. **No levels**: Every message is the same priority. A fill notification and a fatal crash look identical.

4. **No structure**: `"Created order: abc123"` — good luck parsing that in Splunk/Datadog. You need JSON for log aggregation.

5. **No request tracing**: A trader reports "my order disappeared." Which request? Which user? Which symbol? Which timestamp? You have no correlation ID.

## The Solution: Structured Logging with Pino

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  // In production: output JSON for log aggregators
  // In dev: pretty print for humans
});
```

```typescript
// src/routes/orders.ts
import { logger } from '../utils/logger.js';

app.post('/orders', async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'POST /orders', userId: req.userId });

  try {
    childLogger.info({ body: req.body }, 'Creating order');
    const parsed = createOrderSchema.parse(req.body);

    const order = await createOrder(parsed);
    childLogger.info({ orderId: order.id, symbol: order.symbol, side: order.side }, 'Order created');

    res.status(201).json(order);
  } catch (err) {
    childLogger.error({ err, body: req.body }, 'Failed to create order');
    next(err);
  }
});
```

### Production log output:

```json
{
  "level": 30,
  "time": 1715000000000,
  "pid": 42,
  "hostname": "matching-engine-pod-7f8d9",
  "requestId": "abc-123-def",
  "route": "POST /orders",
  "userId": "trader-42",
  "orderId": "ord-789",
  "symbol": "AAPL",
  "side": "buy",
  "msg": "Order created"
}
```

### What structured logging gives you:

| Need | console.log | Pino |
|------|------------|------|
| Persist logs | ❌ Vanishes on restart | ✓ Writes to file/stdout (Docker/ELK captures) |
| Parse in Splunk | ❌ String grep | ✓ JSON fields |
| Filter by level | ❌ All mixed | ✓ `level >= 40` for errors only |
| Trace requests | ❌ Manual grep | ✓ `requestId` correlation |
| Performance | ❌ Synchronous (blocks event loop) | ✓ Asynchronous (buffered) |

## The PAIN of Silent Failures

```typescript
// Without logging:
app.delete('/orders/:id', async (req, res) => {
  await cancelOrder(req.params.id);
  res.status(204).send();
  // Who cancelled it? When? What symbol? You'll never know.
});

// With logging:
app.delete('/orders/:id', async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'DELETE /orders/:id', userId: req.userId });

  try {
    childLogger.info({ orderId: req.params.id }, 'Cancelling order');
    await cancelOrder(req.params.id);
    childLogger.info({ orderId: req.params.id }, 'Order cancelled');
    res.status(204).send();
  } catch (err) {
    childLogger.error({ err, orderId: req.params.id }, 'Failed to cancel order');
    next(err);
  }
});
```

## Logging Evolution in the Trading Engine

| Version | Logging | Visibility |
|---------|---------|------------|
| v1 (JS) | None | Blind |
| v2 (TS) | console.log | Ephemeral, unstructured |
| v3 (Zod) | console.log | Same problems |
| v4 (Pino) | Structured, async, leveled | Full observability |

## The Realization

> Junior: "I added Pino and suddenly I can see exactly which order failed, what the input was, and the full error stack. In JSON."
>
> You: "Logs are your flight recorder. When a trader reports a missing fill at 3am, logs are the only witness. Console.log is a Post-it note. Pino is a black box. In trading, regulators require you to keep those black boxes for 7 years."

## The Next PAIN

Logging tells you what broke. But you find out **after** it breaks. What if we could catch regressions **before** deployment? What if we could prove the matching engine doesn't over-fill under concurrency?

## Next: v5 — Add Testing
