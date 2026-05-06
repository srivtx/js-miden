# 04-event-store.md

## WHAT

The event store is an append-only log of all domain events.

## WHY

Append-only logs are simple, fast, and immutable. They provide a complete history.

## HOW

```typescript
const eventStore: Event[] = [];

function appendEvent(event: Event): void {
  eventStore.push(event); // Append only
}
```

In production, use a dedicated event store like EventStoreDB, Kafka, or PostgreSQL with an events table.
