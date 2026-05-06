# 03-events.md

## WHAT

Events are immutable facts that represent state changes.

## WHY

Events capture intent and context. Unlike state updates, they cannot be changed or deleted.

## HOW

```typescript
interface Event {
  id: string;
  type: 'AccountCreated' | 'MoneyDeposited' | 'MoneyWithdrawn';
  aggregateId: string;
  payload: Record<string, unknown>;
  timestamp: string;
  version: number;
}
```

Each event has a version for optimistic concurrency control.
