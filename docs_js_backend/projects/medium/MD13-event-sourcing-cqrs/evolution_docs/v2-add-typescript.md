# MD13 Event Sourcing + CQRS — v2 Add TypeScript

## Overview
Migrate the CRUD app to TypeScript. Introduce `Order`, `OrderEvent`, and `Command` interfaces. These types lay the groundwork for replacing direct table mutations with an event log.

## Changes
- `tsconfig.json` with `strict: true`
- `src/types.ts`

## Code Snippet
```typescript
// src/types.ts
export interface Order {
  id: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  shippingAddress: Record<string, string>;
}

export interface OrderEvent {
  id: string;
  aggregateId: string;
  eventType: 'OrderPlaced' | 'OrderCancelled';
  eventData: Record<string, unknown>;
  version: number;
  createdAt: Date;
}

export interface PlaceOrderCommand {
  customerId: string;
  items: Order['items'];
  shippingAddress: Record<string, string>;
}
```

## Rationale
- Type safety on events prevents malformed payloads from entering the log.
- The `version` field previews optimistic concurrency control (OCC).

## Trade-offs
- Strict types require disciplined schema evolution; old events may need upcasters.

## Next Step
Add validation (v3) with Zod and introduce the event store table.
