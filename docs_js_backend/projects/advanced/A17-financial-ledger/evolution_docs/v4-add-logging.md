# v4 — Add Logging (Financial Ledger)

## The Scenario

It's 2am. Month-end close is failing. Your junior stares at the console: "The last thing I see is `Ledger running on port 3000`. Then nothing." The accounting team reports the balance sheet is out of balance. You check the logs. There are no logs. Just console output that vanished when the container restarted.

## The PAIN: Console.log Is Not Logging

From v3:

```typescript
app.post('/transactions', async (req, res, next) => {
  try {
    const parsed = journalEntrySchema.parse(req.body);
    const entry = await createJournalEntry(parsed);
    console.log('Created entry:', entry.id); // <-- This is not logging
    res.status(201).json(entry);
  } catch (err) {
    console.error('Error:', err); // <-- This is also not logging
    next(err);
  }
});
```

### What breaks in production:

1. **No persistence**: `console.log` goes to stdout. Docker swallows it. Kubernetes rotates it. When the ledger restarts, logs are gone. Auditors require 7-year retention.

2. **No context**: `"Error: [object Object]"` — you logged an Error object with console.log. The stack trace is gone. You can't debug the balance verification failure.

3. **No levels**: Every message is the same priority. A journal entry creation and a fatal crash look identical.

4. **No structure**: `"Created entry: abc123"` — good luck parsing that in your audit system. You need JSON for log aggregation.

5. **No request tracing**: An auditor asks "who posted this entry?" You have no correlation ID. You have no IP address. You have no user agent.

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
// src/routes/transaction.routes.ts
import { logger } from '../utils/logger.js';

app.post('/transactions', async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'POST /transactions', userId: req.userId });

  try {
    childLogger.info({ body: req.body }, 'Posting journal entry');
    const parsed = journalEntrySchema.parse(req.body);

    const entry = await createJournalEntry(parsed);
    childLogger.info({ entryId: entry.id, hash: entry.hash }, 'Journal entry posted');

    res.status(201).json(entry);
  } catch (err) {
    childLogger.error({ err, body: req.body }, 'Failed to post journal entry');
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
  "hostname": "ledger-pod-7f8d9",
  "requestId": "abc-123-def",
  "route": "POST /transactions",
  "userId": "accountant-42",
  "entryId": "ent-789",
  "hash": "sha256:abc...",
  "msg": "Journal entry posted"
}
```

### What structured logging gives you:

| Need | console.log | Pino |
|------|------------|------|
| Persist logs | ❌ Vanishes on restart | ✓ Writes to file/stdout (Docker/ELK captures) |
| Parse in audit system | ❌ String grep | ✓ JSON fields |
| Filter by level | ❌ All mixed | ✓ `level >= 40` for errors only |
| Trace requests | ❌ Manual grep | ✓ `requestId` correlation |
| Performance | ❌ Synchronous (blocks event loop) | ✓ Asynchronous (buffered) |

## The PAIN of Silent Failures

```typescript
// Without logging:
app.get('/reports/balance/:accountId', async (req, res) => {
  const balance = await getBalance(req.params.accountId);
  res.json(balance);
  // Who queried it? When? What was the result? You'll never know.
});

// With logging:
app.get('/reports/balance/:accountId', async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'GET /reports/balance/:accountId', userId: req.userId });

  try {
    childLogger.info({ accountId: req.params.accountId }, 'Querying balance');
    const balance = await getBalance(req.params.accountId);
    childLogger.info({ accountId: req.params.accountId, balance }, 'Balance queried');
    res.json(balance);
  } catch (err) {
    childLogger.error({ err, accountId: req.params.accountId }, 'Failed to query balance');
    next(err);
  }
});
```

## Logging Evolution in the Financial Ledger

| Version | Logging | Visibility |
|---------|---------|------------|
| v1 (JS) | None | Blind |
| v2 (TS) | console.log | Ephemeral, unstructured |
| v3 (Zod) | console.log | Same problems |
| v4 (Pino) | Structured, async, leveled | Full observability |

## The Realization

> Junior: "I added Pino and suddenly I can see exactly which entry failed, what the hash was, and the full error stack. In JSON."
>
> You: "Logs are your flight recorder. When an auditor asks 'who posted this entry?' at 3am, logs are the only witness. Console.log is a Post-it note. Pino is a black box. In finance, auditors require you to keep those black boxes for 7 years."

## The Next PAIN

Logging tells you what broke. But you find out **after** it breaks. What if we could catch regressions **before** deployment? What if we could prove the ledger never allows unbalanced transactions?

## Next: v5 — Add Testing
