# MD13 Event Sourcing + CQRS — v3 Add Validation

## Overview
Add Zod schemas for commands and create the `event_store` table. Commands are validated before any state change. We still write directly to the `orders` table, but we now also append an event as a side effect (dual-write prelude to full event sourcing).

## Changes
- Add `zod` and `uuid`.
- Create `src/commands/place-order.ts` (command handler).
- Add Prisma migration for `event_store` with `UNIQUE(aggregate_id, version)`.

## Code Snippet
```typescript
// src/commands/place-order.ts
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/index.js';

const placeOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
  })).min(1),
  shippingAddress: z.object({ street: z.string(), city: z.string(), country: z.string(), zipCode: z.string() }),
});

export async function placeOrder(input: unknown) {
  const data = placeOrderSchema.parse(input);
  const aggregateId = uuidv4();
  await prisma.order.create({ data: { ...data, status: 'PENDING' } });
  await prisma.eventStore.create({
    data: {
      id: uuidv4(),
      aggregateId,
      aggregateType: 'Order',
      eventType: 'OrderPlaced',
      eventData: data as any,
      version: 1,
      createdAt: new Date(),
    },
  });
  return { aggregateId };
}
```

## Rationale
- Validation at the command boundary enforces business rules before any persistence.
- The `event_store` table is append-only; we never update or delete rows.
- Dual-write is a migration stepping stone; full event sourcing removes direct `order.create` in v7.

## Trade-offs
- Dual-write is not atomic across two tables without distributed transactions; we accept this temporarily.

## Next Step
Add structured logging (v4) to trace command execution and event append.
