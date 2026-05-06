# State Machines

## Why State Machines?
Subscriptions have a lifecycle with well-defined states and transitions. Using an ad-hoc `if/else` chain leads to bugs (e.g., cancelling an already-cancelled subscription).

## Subscription State Machine

```
                    ┌─────────────┐
                    │   Created   │
                    │  (pending)  │
                    └──────┬──────┘
                           │ charge succeeds
                           ▼
                    ┌─────────────┐
           ┌───────│   Active    │◄──────┐
           │       │             │       │
           │       └──────┬──────┘       │
           │              │               │
    payment│fails         │ user cancels  │payment
           │              │               │succeeds
           ▼              ▼               │
    ┌─────────────┐  ┌─────────────┐     │
    │  Past Due   │  │  Cancelled  │     │
    │  (grace)    │  │  (at period │     │
    │             │  │   end)      │     │
    └──────┬──────┘  └─────────────┘     │
           │                              │
    retry  │succeeds                     │
           └─────────────────────────────┘
           │
    retry  │exhausted
           ▼
    ┌─────────────┐
    │   Unpaid    │
    │  (final)    │
    └─────────────┘
```

## Valid Transitions Table

| From → To | Trigger | Allowed? |
|---|---|---|
| Created → Active | Payment succeeds | Yes |
| Created → Past Due | Payment fails | Yes |
| Active → Cancelled | User requests cancellation | Yes |
| Active → Past Due | Payment fails | Yes |
| Past Due → Active | Payment succeeds | Yes |
| Past Due → Unpaid | Retries exhausted | Yes |
| Past Due → Cancelled | User requests cancellation | Yes |
| Unpaid → Active | Manual intervention | Yes (admin only) |
| Cancelled → Active | Re-subscribe | Yes |
| Active → Created | — | **No** |
| Unpaid → Past Due | — | **No** |

## Implementation

```typescript
type SubscriptionStatus =
  | 'CREATED'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'UNPAID'
  | 'CANCELLED';

type SubscriptionEvent =
  | 'PAYMENT_SUCCEEDED'
  | 'PAYMENT_FAILED'
  | 'USER_CANCELLED'
  | 'RETRIES_EXHAUSTED'
  | 'REACTIVATED';

const TRANSITIONS: Record<SubscriptionStatus, Partial<Record<SubscriptionEvent, SubscriptionStatus>>> = {
  CREATED: {
    PAYMENT_SUCCEEDED: 'ACTIVE',
    PAYMENT_FAILED: 'PAST_DUE',
  },
  ACTIVE: {
    PAYMENT_FAILED: 'PAST_DUE',
    USER_CANCELLED: 'CANCELLED',
  },
  PAST_DUE: {
    PAYMENT_SUCCEEDED: 'ACTIVE',
    RETRIES_EXHAUSTED: 'UNPAID',
    USER_CANCELLED: 'CANCELLED',
  },
  UNPAID: {
    REACTIVATED: 'ACTIVE',
  },
  CANCELLED: {
    REACTIVATED: 'ACTIVE',
  },
};

export function transition(
  current: SubscriptionStatus,
  event: SubscriptionEvent
): SubscriptionStatus {
  const next = TRANSITIONS[current]?.[event];
  if (!next) {
    throw new Error(`Invalid transition: ${current} + ${event}`);
  }
  return next;
}
```

## State Machine in Action

```typescript
export async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscription = await db.subscription.findUnique({
    where: { stripeSubscriptionId: invoice.subscription as string },
  });

  const newStatus = transition(subscription.status as SubscriptionStatus, 'PAYMENT_SUCCEEDED');

  await db.subscription.update({
    where: { id: subscription.id },
    data: { status: newStatus },
  });

  // Side effects
  if (newStatus === 'ACTIVE' && subscription.status === 'PAST_DUE') {
    await sendEmail(subscription.userId, 'Payment recovered');
    await clearDunningSchedule(subscription.id);
  }
}
```

## Invoice State Machine

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Draft     │────▶│   Open      │────▶│   Paid      │────▶│   Voided    │
│  (created)  │     │  (sent)     │     │  (charged)  │     │  (cancelled)│
└─────────────┘     └──────┬──────┘     └─────────────┘     └─────────────┘
                           │
                           │ payment fails
                           ▼
                    ┌─────────────┐
                    │   Uncollectible│
                    │  (written off)│
                    └─────────────┘
```

## Benefits of State Machines

| Benefit | Explanation |
|---|---|
| **Predictability** | Every state change is explicit and testable |
| **Bug prevention** | Invalid transitions throw errors instead of corrupting data |
| **Auditability** | State history is a clear event log |
| **Testing** | Exhaustively test every transition |

## Testing the State Machine

```typescript
import { describe, it, expect } from 'vitest';
import { transition } from './stateMachine';

describe('Subscription State Machine', () => {
  it('CREATED + PAYMENT_SUCCEEDED → ACTIVE', () => {
    expect(transition('CREATED', 'PAYMENT_SUCCEEDED')).toBe('ACTIVE');
  });

  it('ACTIVE + PAYMENT_FAILED → PAST_DUE', () => {
    expect(transition('ACTIVE', 'PAYMENT_FAILED')).toBe('PAST_DUE');
  });

  it('UNPAID + PAYMENT_FAILED → throws', () => {
    expect(() => transition('UNPAID', 'PAYMENT_FAILED')).toThrow();
  });
});
```

## References

- "State Machines in Payment Systems" — Stripe Engineering Blog
- "Designing Data-Intensive Applications" — Martin Kleppmann (Chapter 9)
