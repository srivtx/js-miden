# v4 — Add Logging (Blockchain)

## The Scenario

It's 2am. A mainnet deployment is failing. Your junior stares at the console: "The last thing I see is `Blockchain running on port 3000`. Then nothing." A user reports their transaction is stuck. You check the logs. There are no logs. Just console output that vanished when the validator restarted.

## The PAIN: Console.log Is Not Logging

From v3:

```typescript
app.post('/transactions', async (req, res, next) => {
  try {
    const parsed = transactionSchema.parse(req.body);
    const tx = await createTransaction(parsed);
    console.log('Created transaction:', tx.hash); // <-- This is not logging
    res.status(201).json(tx);
  } catch (err) {
    console.error('Error:', err); // <-- This is also not logging
    next(err);
  }
});
```

### What breaks in production:

1. **No persistence**: `console.log` goes to stdout. Docker swallows it. Kubernetes rotates it. When the validator restarts, logs are gone. You can't investigate the stuck transaction.

2. **No context**: `"Error: [object Object]"` — you logged an Error object with console.log. The stack trace is gone. You can't debug the nonce manager failure.

3. **No levels**: Every message is the same priority. A transaction broadcast and a fatal crash look identical.

4. **No structure**: `"Created transaction: 0xabc..."` — good luck parsing that in your block explorer. You need JSON for log aggregation.

5. **No request tracing**: A user reports "my transaction disappeared." Which request? Which nonce? Which block? You have no correlation ID.

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
// src/routes/transaction.ts
import { logger } from '../utils/logger.js';

app.post('/transactions', async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'POST /transactions', userId: req.userId });

  try {
    childLogger.info({ body: req.body }, 'Creating transaction');
    const parsed = transactionSchema.parse(req.body);

    const tx = await createTransaction(parsed);
    childLogger.info({ hash: tx.hash, nonce: tx.nonce, from: tx.from }, 'Transaction created');

    res.status(201).json(tx);
  } catch (err) {
    childLogger.error({ err, body: req.body }, 'Failed to create transaction');
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
  "hostname": "validator-pod-7f8d9",
  "requestId": "abc-123-def",
  "route": "POST /transactions",
  "userId": "user-42",
  "hash": "0xabc...",
  "nonce": 5,
  "from": "0x123...",
  "msg": "Transaction created"
}
```

### What structured logging gives you:

| Need | console.log | Pino |
|------|------------|------|
| Persist logs | ❌ Vanishes on restart | ✓ Writes to file/stdout (Docker/ELK captures) |
| Parse in block explorer | ❌ String grep | ✓ JSON fields |
| Filter by level | ❌ All mixed | ✓ `level >= 40` for errors only |
| Trace requests | ❌ Manual grep | ✓ `requestId` correlation |
| Performance | ❌ Synchronous (blocks event loop) | ✓ Asynchronous (buffered) |

## The PAIN of Silent Failures

```typescript
// Without logging:
app.post('/mine', async (req, res) => {
  const block = await mineBlock(req.body.transactions);
  res.json(block);
  // Which transactions were included? What was the block hash? You'll never know.
});

// With logging:
app.post('/mine', async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'POST /mine' });

  try {
    childLogger.info({ txCount: req.body.transactions.length }, 'Mining block');
    const block = await mineBlock(req.body.transactions);
    childLogger.info({ blockNumber: block.number, hash: block.hash }, 'Block mined');
    res.json(block);
  } catch (err) {
    childLogger.error({ err }, 'Failed to mine block');
    next(err);
  }
});
```

## Logging Evolution in the Blockchain

| Version | Logging | Visibility |
|---------|---------|------------|
| v1 (JS) | None | Blind |
| v2 (TS) | console.log | Ephemeral, unstructured |
| v3 (Zod) | console.log | Same problems |
| v4 (Pino) | Structured, async, leveled | Full observability |

## The Realization

> Junior: "I added Pino and suddenly I can see exactly which transaction failed, what the nonce was, and the full error stack. In JSON."
>
> You: "Logs are your flight recorder. When a user reports a stuck transaction at 3am, logs are the only witness. Console.log is a Post-it note. Pino is a black box. In a blockchain, that black box is the only way to debug consensus failures."

## The Next PAIN

Logging tells you what broke. But you find out **after** it breaks. What if we could catch regressions **before** deployment? What if we could prove the nonce manager never reuses nonces under concurrency?

## Next: v5 — Add Testing
