# MD13 Event Sourcing + CQRS — v5 Add Testing

## Overview
Add Vitest tests for command handlers, event replay, and projections. We include a test that demonstrates the eventual-consistency gap (read model lag) so the fix in v7 is motivated.

## Changes
- Add `vitest`.
- Create `tests/cqrs.test.ts`.

## Code Snippet
```typescript
// tests/cqrs.test.ts
import { describe, it, expect } from 'vitest';
import { placeOrder } from '../src/commands/place-order.js';
import { projectOrder } from '../src/projections/order-projection.js';
import { prisma } from '../src/config/index.js';

describe('Event Sourcing', () => {
  it('stores an event after placing an order', async () => {
    const result = await placeOrder({
      customerId: 'cust-1',
      items: [{ productId: 'p1', quantity: 1, unitPrice: 10 }],
      shippingAddress: { street: 'St', city: 'City', country: 'US', zipCode: '00000' },
    });
    const events = await prisma.eventStore.findMany({ where: { aggregateId: result.aggregateId } });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('OrderPlaced');
  });

  it('rebuilds read model from events', async () => {
    const { aggregateId } = await placeOrder({ /* ... */ });
    await projectOrder(aggregateId);
    const readModel = await prisma.orderReadModel.findUnique({ where: { aggregateId } });
    expect(readModel).not.toBeNull();
  });
});
```

## Rationale
- Tests guarantee that replaying events produces the same state every time.
- Projection tests verify idempotency (running twice yields the same read model).

## Trade-offs
- Test DB must support Prisma migrations and JSONB columns.

## Next Step
Switch to ESM (v6) for modern module resolution.
