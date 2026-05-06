# Thinking Process

## Mental Models

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Client     │────▶│  PostgreSQL     │────▶│  WAL / Events   │
│  (App)      │     │  (Source of     │     │  Table          │
└─────────────┘     │   Truth)        │     └─────────────────┘
                    └─────────────────┘              │
                                                     ▼
                                              ┌─────────────────┐
                                              │  Event Bus      │
                                              │  (Dispatcher)   │
                                              └─────────────────┘
                                                     │
                                    ┌────────────────┼────────────────┐
                                    ▼                ▼                ▼
                              ┌──────────┐   ┌──────────┐   ┌──────────┐
                              │  Cache   │   │  Notify  │   │  Search  │
                              │ Consumer │   │ Consumer │   │ Consumer │
                              └──────────┘   └──────────┘   └──────────┘
```

## The Hot Path
The write path: `INSERT → publishChange → return to client`. This must be fast. The actual consumer dispatch can be asynchronous.

## The Danger Zone
1. **Missed Changes**: Offset jumps ahead. Events are skipped forever. Cache is stale.
2. **Out-of-Order**: UPDATE processed before INSERT. Cache shows data for a row that "doesn't exist yet."
3. **Replay Storm**: Offset resets to 0. All historical events are re-processed. Emails re-sent, cache thrashed.

## Question Everything
- Do we need Kafka? For production, yes. For learning, an in-memory dispatcher is enough.
- Do we need exactly-once? At-least-once + idempotent consumers is usually sufficient.
- Do we need synchronous dispatch? No — async with offset tracking is fine.

## The "What If" Game
- What if the consumer crashes mid-batch? Re-process from last committed offset.
- What if two consumers process the same event? Idempotency keys prevent double work.
- What if events are published but the transaction rolls back? Use WAL reading (post-commit) instead of triggers.
