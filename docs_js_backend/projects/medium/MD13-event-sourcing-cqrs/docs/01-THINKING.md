# Thinking Process

## Mental Models

```
┌─────────────────────────────────────────────────────────────┐
│                        COMMAND SIDE                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Client     │───▶│   Command    │───▶│  Event Store │  │
│  │   (HTTP)     │    │   Handler    │    │  (PostgreSQL)│  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                                            │       │
│         │         (Async Projection)                 │       │
│         │                                            ▼       │
│         │                                    ┌──────────────┐│
│         │                                    │   Pub/Sub    ││
│         │                                    │  (setImmediate)│
│         │                                    └──────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         QUERY SIDE                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Client     │◀───│   Query      │◀───│  Read Model  │  │
│  │   (HTTP)     │    │   Handler    │    │  (PostgreSQL)│  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         ▲                                            ▲       │
│         │         (Rebuild from Events)              │       │
│         └────────────────────────────────────────────┘       │
│                                                              │
│  ┌──────────────┐                                            │
│  │  Projection  │───▶ Replays events ──▶ Upserts Read Model │
│  │  (Order)     │                                            │
│  └──────────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

## The Hot Path
The hot path is `PlaceOrderCommand.execute()`. It must:
1. Validate input (Zod).
2. Generate aggregate ID.
3. Create the `OrderPlaced` event.
4. Append to the event store (single `INSERT`).
5. Trigger projection (async).

The event store append is the bottleneck. It must be a fast, single-row insert.

## The Danger Zone
1. **Direct Read from Write Model**: A developer queries the event store directly for reads. This defeats CQRS — reads are slow (event replay) and put load on the write database.
2. **Eventual Consistency Gap**: After placing an order, the read model is empty for 100ms. The client immediately GETs the order and gets 404.
3. **Snapshot Blindness**: Replaying 10K events for an aggregate takes 500ms. Without snapshots, read model rebuilds are prohibitively slow.

## Question Everything
- Do we need CQRS for a simple CRUD app? No. CQRS adds complexity. Use it when reads and writes have different scaling needs or when audit is required.
- Do we need event sourcing for every entity? No. Only for entities with complex lifecycles or audit requirements. User profiles can be CRUD.
- Do projections have to be async? No — synchronous projections are simpler but couple read and write latency. Async is preferred for scale.
- Do we store snapshots in the same DB? Yes, for simplicity. In production, snapshots might go to a faster KV store.

## The "What If" Game
- What if the projection fails? The read model is stale. The event store is still correct. Retry the projection.
- What if two commands run concurrently? Optimistic concurrency control (versioning) prevents lost updates. If both append version 3, one fails with a unique constraint violation.
- What if we need to change the read model schema? Rebuild all projections from the event store. This is the superpower of event sourcing.
