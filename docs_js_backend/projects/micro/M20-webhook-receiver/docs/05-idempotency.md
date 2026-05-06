# Idempotency

## WHAT

An operation is **idempotent** if performing it multiple times produces the same result as performing it once. In webhooks, this means:

- Receiving the same `payment.success` event twice must not double-charge the customer.
- Receiving the same `user.created` event twice must not create duplicate users.

## WHY

Webhooks are unreliable by design. Providers retry on:

- Network timeouts.
- `5xx` responses.
- Slow responses (risk of timeout before `2xx`).

Stripe, for example, retries a webhook up to **3 times over 3 days** with exponential backoff. Without idempotency, every retry is a potential duplicate side effect.

## HOW

**Three layers of defense:**

1. **Idempotency key:** Use the provider's event ID (`evt_123`). Store it in a deduplication table or cache (Redis with TTL).
2. **State machine:** Only process events if the current state allows the transition.
   - `pending` → `paid` is valid.
   - `paid` → `paid` is a no-op.
3. **Database uniqueness:** Use unique constraints on composite keys (e.g., `(event_source, event_id)`).

```javascript
const redis = require("redis");
const client = redis.createClient();

async function processWebhook(event) {
  const key = `webhook:${event.source}:${event.id}`;
  const isNew = await client.setNX(key, "1"); // Atomically set if not exists
  if (!isNew) {
    console.log(`Deduplicate: ${key}`);
    return { status: "ignored", reason: "duplicate" };
  }
  await client.expire(key, 86400 * 3); // TTL = 3 days

  // State machine guard
  const order = await db.order.findUnique({ where: { id: event.orderId } });
  if (order.status === "paid") {
    return { status: "ignored", reason: "already_paid" };
  }

  await db.order.update({ where: { id: event.orderId }, data: { status: "paid" } });
  return { status: "processed" };
}
```

## WRONG vs RIGHT

### WRONG: No Deduplication

```javascript
// BAD: Every retry creates a new side effect
app.post("/webhooks/stripe", async (req, res) => {
  const event = stripe.webhooks.constructEvent(req.body, sig, SECRET);
  await db.payment.create({ data: { amount: event.data.amount } }); // Duplicate!
  res.sendStatus(200);
});
```

### RIGHT: Idempotency Key + State Machine

```javascript
// GOOD: Deduplicate and guard state transitions
app.post("/webhooks/stripe", async (req, res) => {
  const event = stripe.webhooks.constructEvent(req.body, sig, SECRET);
  const result = await processWebhook({
    source: "stripe",
    id: event.id,
    orderId: event.data.object.id,
    amount: event.data.object.amount
  });
  res.status(result.status === "processed" ? 200 : 409).json(result);
});
```

## Timeline: Retry Race Condition

```
Time ─────────────────────────────────────────────────>

Provider: ──[Webhook evt_1]──────────────[Retry evt_1]──────→
                │                              │
Receiver:    [Process]──→ DB write (200ms)
                          │
                          └─[Retry arrives while first is still in flight]
                                │
                                └── Without atomic check:
                                    Two DB writes for same event.

Mitigation:
  - Atomic SETNX in Redis before any DB work.
  - Or use DB unique constraint on (source, event_id).
```

## Breach Story: Coinbase Double-Credit (2018)

In 2018, Coinbase experienced a brief incident where webhook retries for cryptocurrency deposits were processed multiple times due to a race condition in their idempotency check. Some users were double-credited. Coinbase's post-mortem identified that their deduplication logic was not atomic: two parallel workers could both check for the event ID, see it missing, and both insert it. The fix was to use a database `UNIQUE` constraint and atomic `INSERT ... ON CONFLICT DO NOTHING`.

## References

- Stripe: Idempotency — https://stripe.com/docs/api/idempotent_requests
- Fielding, R. (2000). *REST dissertation* — idempotency definition
- OWASP: Testing for Race Conditions — https://owasp.org/www-project-web-security-testing-guide/
