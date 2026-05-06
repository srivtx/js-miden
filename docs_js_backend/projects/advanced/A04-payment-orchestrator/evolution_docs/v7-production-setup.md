# v7 — Production Setup (Multi-Provider + Fallback + Reconciliation)

Your payment works. But it's one provider, no fallback, no idempotency, and no reconciliation. At scale, this loses money.

---

## Architecture Evolution: Single Provider → Multi-Provider + Services

```
Single Provider (v1-v5)
    ↓
Multi-Provider with Fallback (v7)
    ↓
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Payment   │────▶│  Provider   │────▶│  Provider   │
│   Gateway   │     │  A (Stripe) │     │  B (PayPal) │
└─────────────┘     └─────────────┘     └─────────────┘
        │
        └──────────────▶ DB ◀──────────────────────────┘
                             │
                        ┌────┴────┐
                        │Reconcile│
                        │ Service │
                        └─────────┘
```

---

## Pain #1: Provider Downtime = No Revenue

Stripe is down. Your checkout page fails. Every minute of downtime costs thousands.

**Fix:** Multiple providers with automatic fallback.

```ts
// gateway-service/src/orchestrator.ts
import { charge as stripeCharge } from '../providers/stripe.js';
import { charge as paypalCharge } from '../providers/paypal.js';

interface Provider {
  name: string;
  charge: (amount: number, currency: string, token: string) => Promise<ChargeResult>;
}

const providers: Provider[] = [
  { name: 'stripe', charge: stripeCharge },
  { name: 'paypal', charge: paypalCharge },
];

export async function processCharge(
  amount: number,
  currency: string,
  token: string,
  preferredProvider?: string
): Promise<ChargeResult> {
  const ordered = preferredProvider
    ? providers.sort((a) => (a.name === preferredProvider ? -1 : 1))
    : providers;

  for (const provider of ordered) {
    try {
      logger.info({ provider: provider.name }, 'Attempting charge');
      const result = await provider.charge(amount, currency, token);
      logger.info({ provider: provider.name, chargeId: result.id }, 'Charge succeeded');
      return { ...result, provider: provider.name };
    } catch (err) {
      logger.warn({ provider: provider.name, error: (err as Error).message }, 'Provider failed, trying next');
    }
  }

  throw new Error('All providers failed');
}
```

Stripe fails? PayPal is tried automatically. Revenue is protected.

---

## Pain #2: Double Charges on Retries

A user clicks "Pay". The request times out. They click again. Two charges. Support tickets explode.

**Fix:** Idempotency with distributed lock.

```ts
// gateway-service/src/idempotency.ts
import Redis from 'ioredis';
const redis = new Redis();

export async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds = 86400
): Promise<T> {
  const lockKey = `idempotency:${key}`;

  // Try to acquire lock
  const acquired = await redis.set(lockKey, 'processing', 'EX', 60, 'NX');
  if (!acquired) {
    // Key exists — check if processing or done
    const existing = await redis.get(lockKey);
    if (existing && existing !== 'processing') {
      logger.info({ idempotencyKey: key }, 'Returning cached result');
      return JSON.parse(existing);
    }
    throw new Error('Duplicate request in progress');
  }

  try {
    const result = await fn();
    await redis.setex(lockKey, ttlSeconds, JSON.stringify({ status: 'completed', result }));
    return result;
  } catch (err) {
    await redis.del(lockKey); // Release lock on failure so retry is possible
    throw err;
  }
}

// Usage
const result = await withIdempotency(idempotencyKey, () =>
  processCharge(amount, currency, token)
);
```

Same idempotency key = same result. Even across retries, restarts, and different provider attempts.

---

## Pain #3: Your Ledger Doesn't Match Provider Ledgers

Your DB says $50,000 revenue this month. Stripe's dashboard says $49,200. Where's the $800? You have no way to find out.

**Fix:** Reconciliation Service.

```ts
// reconciliation-service/src/index.ts
import { schedule } from 'node-cron';

schedule('0 2 * * *', async () => {
  logger.info('Starting daily reconciliation');

  // Fetch all charges from DB
  const dbCharges = await db
    .selectFrom('charges')
    .select(['provider_charge_id', 'amount', 'provider', 'status'])
    .where('created_at', '>', new Date(Date.now() - 86400000))
    .execute();

  // Fetch from Stripe
  const stripeCharges = await fetchAllStripeCharges(yesterday);

  // Find mismatches
  const mismatches = [];
  for (const db of dbCharges) {
    const provider = stripeCharges.find((p) => p.id === db.provider_charge_id);
    if (!provider) {
      mismatches.push({ type: 'missing_in_provider', db });
    } else if (provider.amount !== db.amount) {
      mismatches.push({ type: 'amount_mismatch', db, provider });
    } else if (provider.status !== db.status) {
      mismatches.push({ type: 'status_mismatch', db, provider });
    }
  }

  // Find charges in provider but not in DB
  for (const provider of stripeCharges) {
    const db = dbCharges.find((d) => d.provider_charge_id === provider.id);
    if (!db) {
      mismatches.push({ type: 'missing_in_db', provider });
    }
  }

  if (mismatches.length > 0) {
    logger.error({ mismatches }, 'Reconciliation failures detected');
    await alertOpsTeam(mismatches);
  } else {
    logger.info('Reconciliation complete: no mismatches');
  }
});
```

Every night at 2 AM, the system checks every charge. Missing records, amount mismatches, and status discrepancies are flagged and alerted.

---

## Pain #4: Partial Failures Leave Data Inconsistent

A charge succeeds with Stripe, but your DB write fails. The customer was charged, but you have no record of it. The reconciliation service finds it... tomorrow.

**Fix:** Outbox pattern + eventual consistency.

```ts
// gateway-service/src/outbox.ts
async function processChargeWithOutbox(request: ChargeRequest) {
  await db.transaction().execute(async (trx) => {
    // 1. Write to outbox
    await trx.insertInto('outbox').values({
      id: crypto.randomUUID(),
      type: 'charge',
      payload: JSON.stringify(request),
      status: 'pending',
      created_at: new Date(),
    }).execute();

    // 2. Process charge (will be picked up by worker)
  });
}

// worker-service/src/processor.ts
const worker = new Worker('outbox', async (job) => {
  const request = JSON.parse(job.data.payload);
  const result = await processCharge(request.amount, request.currency, request.token);

  // Update charge record
  await db.insertInto('charges').values({
    provider_charge_id: result.id,
    amount: request.amount,
    currency: request.currency,
    provider: result.provider,
    status: result.status,
  }).execute();

  // Mark outbox as processed
  await db.updateTable('outbox')
    .set({ status: 'processed', processed_at: new Date() })
    .where('id', '=', job.data.id)
    .execute();
});
```

The outbox ensures: DB write happens first, charge processing happens reliably, and reconciliation can always check the outbox state.

---

## Pain #5: No Visibility Into Provider Health

You don't know Stripe's failure rate until customers complain.

**Fix:** Metrics and circuit breakers.

```ts
// gateway-service/src/metrics.ts
class ProviderMetrics {
  private failures = new Map<string, number>();
  private total = new Map<string, number>();

  record(provider: string, success: boolean) {
    this.total.set(provider, (this.total.get(provider) || 0) + 1);
    if (!success) {
      this.failure.set(provider, (this.failures.get(provider) || 0) + 1);
    }
  }

  getFailureRate(provider: string): number {
    const total = this.total.get(provider) || 0;
    const failures = this.failures.get(provider) || 0;
    return total === 0 ? 0 : failures / total;
  }
}

// Alert if failure rate > 5%
setInterval(() => {
  for (const provider of providers) {
    const rate = metrics.getFailureRate(provider.name);
    if (rate > 0.05) {
      alert(`Provider ${provider.name} failure rate: ${(rate * 100).toFixed(1)}%`);
    }
  }
}, 60000);
```

---

## Final Checklist

- [ ] Multiple providers: Stripe, PayPal, etc.
- [ ] Automatic fallback: try next provider on failure
- [ ] Idempotency: distributed lock + cached results
- [ ] Reconciliation: daily comparison of DB vs provider ledgers
- [ ] Outbox pattern: DB write first, process reliably
- [ ] Circuit breakers: stop calling failing providers
- [ ] Provider metrics: track failure rates, alert on threshold
- [ ] Validation: amount limits, currency checks, token environment checks
- [ ] Structured logging: every charge attempt, success, failure
- [ ] Environment-based config: provider keys, fallback order, thresholds

This is a production payment orchestrator. It started as a single Stripe charge call. Now it's a resilient, multi-provider system with fallback, idempotency, reconciliation, and operational visibility.
