# WHY: Retry Logic

## The Problem

Transient failures are common in distributed systems:
- Network blips (0.1% of requests)
- Service restarts during deployment
- Temporary overload during traffic spikes
- Database lock contention

Without retries, these transient failures become user-facing errors.

## Why Retry Logic Helps

### 1. Improved Reliability
99.9% of transient failures succeed on retry. Users experience fewer errors.

### 2. Automatic Recovery
No manual intervention needed. The system heals itself when the underlying issue resolves.

### 3. Better User Experience
A 3-second retry is invisible to users. A permanent error requires them to retry manually.

### 4. Cost Efficiency
Retried requests are cheaper than lost transactions, support tickets, or user churn.

## Without Retry Logic

```
Payment processing fails due to 1-second network blip
→ User sees "Payment failed"
→ User retries manually
→ Support ticket created
→ Transaction lost
→ Revenue impact
```

## With Retry Logic

```
Payment processing fails due to 1-second network blip
→ Retry in 1 second
→ Payment succeeds
→ User sees "Payment confirmed"
→ Zero support tickets
→ Revenue protected
```

## Why Not Just Retry Everything?

- **4xx errors**: Client mistake. Retrying won't help.
- **Idempotency**: Retrying POST can create duplicates.
- **Thundering herd**: Synchronized retries overload recovering services.

## Business Impact

- **Reliability**: Higher success rates
- **User Satisfaction**: Fewer visible errors
- **Operational Cost**: Fewer support tickets
- **Revenue**: Fewer abandoned transactions
