# Step-by-Step Build Guide

## Step 1: Create the Event Store Schema

```sql
CREATE TABLE event_store (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  UNIQUE(aggregate_id, version)
);
CREATE INDEX idx_event_store_aggregate ON event_store(aggregate_id, version);
CREATE INDEX idx_event_store_type ON event_store(event_type, created_at);
```

### Common Mistakes
- **Mistake**: No unique constraint on `(aggregate_id, version)`.
- **Why it breaks**: Concurrent commands can append duplicate versions. Lost updates.
- **How to avoid**: `UNIQUE(aggregate_id, version)` enforces optimistic concurrency control.

## Step 2: Define Events

```typescript
export interface OrderPlacedEvent {
  id: string;
  aggregateId: string;
  aggregateType: 'Order';
  eventType: 'OrderPlaced';
  eventData: {
    customerId: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    totalAmount: number;
    shippingAddress: Record<string, string>;
  };
  version: number;
  createdAt: Date;
  metadata: { correlationId: string; causationId?: string };
}
```

### Common Mistakes
- **Mistake**: Using `any` for `eventData`.
- **Why it breaks**: No type safety, can't upcast old events.
- **How to avoid**: Strict TypeScript interfaces with schema versioning.

## Step 3: Implement the Command Handler

```typescript
export class PlaceOrderCommand {
  async execute(input: PlaceOrderInput) {
    const validated = placeOrderSchema.parse(input);
    const aggregateId = uuidv4();
    const totalAmount = validated.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const event = createOrderPlacedEvent({ aggregateId, customerId: validated.customerId, items: validated.items, totalAmount, shippingAddress: validated.shippingAddress, version: 1 });
    await this.eventStore.append(event);
    setImmediate(() => this.projection.project(aggregateId).catch(console.error));
    return { aggregateId, version: event.version };
  }
}
```

### Common Mistakes
- **Mistake**: Validating business rules against the read model.
- **Why it breaks**: Read model is stale. Rules might pass on stale data.
- **How to avoid**: Replay events from the event store to determine current state before applying business rules.

## Step 4: Build the Projection

```typescript
export class OrderProjection {
  async project(aggregateId: string) {
    const events = await this.eventStore.getEvents(aggregateId);
    if (events.length === 0) return;
    const state = this.replayEvents(aggregateId, events);
    await prisma.orderReadModel.upsert({
      where: { aggregateId },
      create: { aggregateId, customerId: state.customerId, status: state.status, totalAmount: state.totalAmount, items: state.items, shippingAddress: state.shippingAddress, version: events.length, projectedAt: new Date() },
      update: { status: state.status, totalAmount: state.totalAmount, items: state.items, shippingAddress: state.shippingAddress, version: events.length, projectedAt: new Date() },
    });
  }
}
```

### Common Mistakes
- **Mistake**: Not tracking version in the read model.
- **Why it breaks**: Can't detect if projection is stale.
- **How to avoid**: Store `version` in the read model and expose it in queries.

## Step 5: Implement Snapshots

```typescript
async createSnapshot(aggregateId: string, state: Record<string, unknown>, version: number) {
  await prisma.snapshot.create({ data: { aggregateId, aggregateType: 'Order', state, version } });
}

async replayAggregate(aggregateId: string) {
  const snapshot = await this.getLatestSnapshot(aggregateId);
  let state = snapshot?.state ?? {};
  const fromVersion = snapshot?.version ?? 0;
  const events = await this.getEventsFromVersion(aggregateId, fromVersion);
  for (const event of events) {
    state = this.applyEvent(state, event);
  }
  return state;
}
```

### Common Mistakes
- **Mistake**: Snapshots as primary data.
- **Why it breaks**: Corrupt snapshot = permanent data loss.
- **How to avoid**: Events are the source of truth. Snapshots are a performance cache.

## Step 6: Build the Read Model API

```typescript
async getById(id: string) {
  return prisma.orderReadModel.findUnique({ where: { aggregateId: id } });
}

async list(options: { customerId?: string; status?: string; limit?: number; offset?: number }) {
  return prisma.orderReadModel.findMany({
    where: { ...(options.customerId && { customerId: options.customerId }), ...(options.status && { status: options.status }) },
    take: options.limit ?? 20,
    skip: options.offset ?? 0,
    orderBy: { projectedAt: 'desc' },
  });
}
```

### Common Mistakes
- **Mistake**: Querying the event store directly.
- **Why it breaks**: Slow, not indexed, defeats CQRS purpose.
- **How to avoid**: Read model is the ONLY query source.
