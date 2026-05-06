# 04-OLD-VS-NEW.md

## 2015 Patterns vs 2025 Patterns

### Storage

**2015: Rolling Your Own**
```javascript
// Ad-hoc array, no serialization guarantees
const eventStore = [];
eventStore.push(event);
```

**2025: EventStoreDB or Axon Server**
```typescript
// Purpose-built event store with subscriptions, projections
const stream = client.readStream('account-123');
const subscription = client.subscribeToStream('account-123');
```

**2025: PostgreSQL with JSONB**
```sql
-- Events table with proper indexing, constraints
CREATE TABLE events (
  id UUID PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  version INT NOT NULL,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(aggregate_id, version)
);
CREATE INDEX idx_events_aggregate ON events(aggregate_id, version);
```

### Serialization

**2015: JSON.stringify with no schema**
```javascript
// Events drift over time, no validation
JSON.stringify({ type: 'Deposit', amount: 100 });
```

**2025: Schema Registry + Avro/Protobuf**
```typescript
// Events are versioned, validated, and backward-compatible
const event = EventSchema.parse({
  type: 'MoneyDeposited',
  version: 2,
  payload: { amount: 100, currency: 'USD' }
});
```

### Snapshots

**2015: In-process Map**
```javascript
// Lost on restart, no durability
const snapshots = new Map();
```

**2025: Redis or Dedicated Snapshot Store**
```typescript
// External, durable, shared across instances
await redis.set(`snapshot:${aggregateId}`, JSON.stringify(snapshot));
```

### CQRS / Projections

**2015: Monolithic read model**
```javascript
// Same process rebuilds state for reads
app.get('/balance/:id', (req, res) => {
  res.json(rebuildState(req.params.id));
});
```

**2025: Async Projections to Read Stores**
```
Command Side:
  API -> Append Event -> Event Store
                          |
Read Side:                v
  Event Store -> Projection Handler -> PostgreSQL / Elasticsearch / Redis
```

```typescript
// Projection worker (separate process)
eventStore.subscribe('MoneyDeposited', async (event) => {
  await db('account_balances')
    .where('id', event.aggregateId)
    .increment('balance', event.payload.amount);
});
```

### Event Versioning (Upcasting)

**2015: No upcasting**
```javascript
// Old events break new code
if (event.payload.amount) { ... }  // Fails if field was renamed
```

**2025: Upcaster Pipeline**
```typescript
const upcasters = [
  (event) => event.version === 1 && event.type === 'MoneyDeposited'
    ? { ...event, version: 2, payload: { ...event.payload, currency: 'USD' } }
    : event,
];

function replay(events) {
  return events.map(e => upcasters.reduce((ev, up) => up(ev), e));
}
```

### Testing

**2015: State-based assertions**
```javascript
// Tests verify end state, not event sequence
deposit(100);
assert(balance === 100);
```

**2025: Event-sourced testing**
```typescript
// Tests verify events AND state
const events = given([
  AccountCreated({ owner: 'Alice' }),
  MoneyDeposited({ amount: 100 }),
]);

when(MoneyWithdrawn({ amount: 50 }));

then([
  MoneyWithdrawn({ amount: 50, version: 3 }),
]);

expect(balance).toBe(50);
```

### Cloud-Native Event Sourcing

```
2015 Single Server:
┌──────────────────────────────────┐
│  App + Event Store + Snapshots   │
└──────────────────────────────────┘

2025 Distributed:
┌──────────┐    ┌──────────────┐    ┌─────────────┐
│ API Pods │───>│ Kafka/Pulsar │───>│ Projection  │
│ (k8s)    │    │ (Event Bus)  │    │ Workers     │
└──────────┘    └──────────────┘    └──────┬──────┘
                                           │
                                    ┌──────▼──────┐
                                    │ PostgreSQL  │
                                    │ Read Models │
                                    └─────────────┘
```
