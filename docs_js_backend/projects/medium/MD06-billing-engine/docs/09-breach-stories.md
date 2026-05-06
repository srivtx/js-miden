# Real Breach Stories & Lessons

## Story 1: Stripe Outage (July 2019)

### What Happened
On July 10, 2019, Stripe experienced a **14-hour partial outage** affecting card payments globally. The root cause was a **cascading failure**: a bad configuration change in a database cluster triggered a failover, which overloaded the remaining nodes, causing further failovers.

### Impact
- Millions of dollars in lost transactions
- Merchants unable to process payments
- Reputational damage

### Lessons
1. **Circuit breakers**: If Stripe's API is down, queue payments locally and retry later
2. **Graceful degradation**: Allow offline mode or deferred billing
3. **Multi-gateway strategy**: Fall back to a secondary provider (Adyen, Braintree)

```typescript
class PaymentGatewayRouter {
  private gateways = [
    new StripeGateway(),
    new AdyenGateway(), // fallback
  ];

  async charge(amount: number, currency: string) {
    for (const gateway of this.gateways) {
      try {
        return await gateway.charge(amount, currency);
      } catch (error) {
        if (gateway !== this.gateways[this.gateways.length - 1]) {
          console.warn(`${gateway.name} failed, trying fallback...`);
        }
      }
    }
    throw new Error('All payment gateways failed');
  }
}
```

---

## Story 2: Payment Double-Charges (2015)

### What Happened
A SaaS company implemented retry logic without **idempotency keys**. When Stripe's API experienced elevated latency, their system interpreted timeouts as failures and retried the charge. Because the original charge had actually succeeded, customers were charged **multiple times**.

### Impact
- 847 duplicate charges
- Refunds issued with apologies
- Customer trust severely damaged

### Root Cause
```typescript
// BAD: No idempotency key
async function chargeCustomer(amount: number) {
  try {
    return await stripe.charges.create({ amount, customer: 'cus_123' });
  } catch (error) {
    if (error.type === 'StripeConnectionError') {
      // Retry without checking if first succeeded!
      return await stripe.charges.create({ amount, customer: 'cus_123' });
    }
    throw error;
  }
}

// GOOD: Idempotency key prevents duplicates
async function chargeCustomer(amount: number, idempotencyKey: string) {
  return await stripe.charges.create(
    { amount, customer: 'cus_123' },
    { idempotencyKey }
  );
}
```

---

## Story 3: Webhook Replay Attack (2018)

### What Happened
A payment platform's webhook endpoint did not verify **event IDs** for idempotency. An attacker replayed a `charge.succeeded` webhook 50 times, causing the merchant to ship 50 units of product for a single payment.

### Impact
- $12,000 in fraudulent shipments
- Chargebacks from real customers

### Mitigation
```typescript
const processedEvents = new Set<string>();

app.post('/webhooks/stripe', (req, res) => {
  const event = req.body as Stripe.Event;

  if (processedEvents.has(event.id)) {
    return res.status(200).send('Already processed');
  }

  processEvent(event);
  processedEvents.add(event.id);

  res.status(200).send('OK');
});
```

---

## Story 4: CVV Storage Violation (2017)

### What Happened
A retailer stored CVV codes in their database "for convenience" to avoid asking customers to re-enter them. During a breach, 2.4 million CVVs were leaked. The retailer lost their PCI compliance certification and faced $50M in fines.

### PCI-DSS Requirement 3.2.1
> "Do not store the card verification code or value (three-digit or four-digit number printed on the front or back of a payment card) after authorization."

### Lesson
**Never store CVV**. Not in logs, not in databases, not in caches. Use tokenization.

---

## Story 5: Subscription State Machine Bug (2020)

### What Happened
A subscription service allowed a cancelled subscription to be "refunded" and then immediately reactivated, bypassing the payment step. The bug was in an ad-hoc state transition check:

```typescript
// BUGGY: Missing validation
if (action === 'reactivate') {
  subscription.status = 'ACTIVE'; // No check for CANCELLED → ACTIVE
}
```

Attackers created free lifetime subscriptions by:
1. Subscribing with a valid card
2. Cancelling immediately for a refund
3. Reactivating the subscription

### Fix
Use a strict state machine (see `05-state-machines.md`):

```typescript
const next = transition(subscription.status, 'REACTIVATED');
// CANCELLED → ACTIVE is valid, but must require payment
```

---

## Summary: Lessons Applied

| Story | Lesson | Implementation |
|---|---|---|
| Stripe outage | Multi-gateway, circuit breakers | Fallback providers, retry queues |
| Double-charges | Idempotency keys | Redis + DB atomic checks |
| Webhook replay | Event idempotency | Processed event ID set |
| CVV storage | Never store sensitive data | Tokenization only |
| State machine bug | Explicit transitions | State machine + tests |

## OWASP Reference

> "Study past security incidents in your industry. Use them to inform threat modeling and security requirements." -- OWASP Threat Modeling Cheat Sheet

> "Assume your payment gateway will fail. Design for resilience, not perfection." -- OWASP Resilience Cheat Sheet
