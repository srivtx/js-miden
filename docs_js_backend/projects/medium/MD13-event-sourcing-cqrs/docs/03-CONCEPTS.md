# Concepts Explained

## Concept: Event Sourcing

### WHAT Is It?
Storing the state of an application as a sequence of immutable events, rather than storing the current state directly.

### WHY Do We Use It?
- **Audit**: Every change is recorded. You know who did what and when.
- **Debugging**: Replay events to reproduce bugs.
- **Temporal Queries**: "What was the order state at 3 PM yesterday?"
- **Schema Evolution**: Old events can be upcasted to new schemas.

### HOW Does It Work?
```
Traditional CRUD:        Event Sourcing:
┌─────────────┐         ┌─────────────────┐
│  Order Table│         │   Event Store   │
│  id | status│         │  id | type | data│
├─────────────┤         ├─────────────────┤
│  1  | SHIPPED│        │  1  | OrderPlaced│
└─────────────┘        │  2  | OrderConfirmed│
                       │  3  | OrderShipped│
                       └─────────────────┘
                              ↓
                       Replay events → Current state
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Updating events in place (mutable log). | Append-only. Never update or delete events. |
| Storing only the event type, no payload. | Storing full event payload with schema version. |
| No correlation/causation IDs. | Including metadata for tracing (correlationId, causationId). |

---

## Concept: CQRS (Command Query Responsibility Segregation)

### WHAT Is It?
Separating the read model (queries) from the write model (commands) so they can be optimized independently.

### WHY Do We Use It?
- **Read Optimization**: Denormalized, indexed read models for fast queries.
- **Write Optimization**: Normalized, transactional write models for consistency.
- **Scaling**: Scale read replicas independently from write nodes.

### HOW Does It Work?
```
┌─────────────┐         ┌──────────────┐
│   Command   │────▶    │  Write Model │
│  (PlaceOrder)│        │ (Event Store)│
└─────────────┘         └──────────────┘
                              │
                         Projection
                              │
                              ▼
┌─────────────┐         ┌──────────────┐
│    Query    │◀────    │  Read Model  │
│ (GetOrders) │        │ (Denormalized)│
└─────────────┘         └──────────────┘
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Querying the event store directly. | Querying the read model only. |
| Writing to the read model. | Sending commands to the write model. |
| Synchronous projections for all reads. | Async projections with eventual consistency acceptance. |

---

## Concept: Projections

### WHAT Is It?
A function that transforms a stream of events into a read-optimized view.

### WHY Do We Use It?
Event stores are not queryable by `customerId` or `status`. Projections build indexes, materialized views, and search documents.

### HOW Does It Work?
```typescript
async project(aggregateId: string) {
  const events = await eventStore.getEvents(aggregateId);
  const state = replayEvents(events); // { status: 'PENDING', totalAmount: 99.99, ... }
  await prisma.orderReadModel.upsert({
    where: { aggregateId },
    create: { aggregateId, ...state, version: events.length },
    update: { ...state, version: events.length },
  });
}
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Projection modifying the event store. | Projection only reads events, writes read model. |
| One projection doing everything. | Multiple focused projections (order summary, order items, audit log). |
| No versioning in read model. | Tracking `version` to detect stale projections. |

---

## Concept: Snapshots

### WHAT Is It?
A periodic capture of an aggregate's state at a specific version, used to speed up replay.

### WHY Do We Use It?
Replaying 10,000 events for a long-lived aggregate is slow. Snapshots let you start replay from the snapshot version instead of version 1.

### HOW Does It Work?
```
Events:  [E1][E2][E3]...[E100] [E101]...[E200]
               ▲                    ▲
            Snapshot v100        Snapshot v200

Replay:  Load Snapshot v200 → Replay E201 onwards
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| Snapshots as the primary data. | Snapshots as a cache. Events are the source of truth. |
| No snapshot versioning. | Storing snapshot version to know which events to replay. |
| Snapshots on every event. | Snapshots every N events or time interval. |

---

## Concept: Optimistic Concurrency Control

### WHAT Is It?
Preventing conflicting writes by checking the expected version before appending.

### WHY Do We Use It?
Two commands might run concurrently on the same aggregate. Without OCC, events could be appended out of order or with duplicate versions.

### HOW Does It Work?
```typescript
// Append event with version
await prisma.eventStore.create({
  data: { aggregateId, eventType, eventData, version: expectedVersion },
});
// UNIQUE constraint on (aggregateId, version) prevents duplicates
```

### WRONG vs RIGHT
| WRONG | RIGHT |
|-------|-------|
| No version field. | Monotonically increasing version per aggregate. |
| Pessimistic locking (SELECT FOR UPDATE). | Optimistic concurrency with unique constraints. |
| Retrying indefinitely on conflict. | Bounded retries with exponential backoff. |
