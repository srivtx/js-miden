# 01-THINKING.md

## Design Thinking: Events as Source of Truth

When building this bank account system, the mental model must shift from "tables" to "histories."

### CRUD Thinking (Old Way)

```
Developer sees: "An account has a balance"
Developer writes:
  UPDATE accounts SET balance = balance + 100 WHERE id = 123;

Mental model: State is truth. The row IS the account.
```

### Event Sourcing Thinking (New Way)

```
Developer sees: "A balance is the result of deposits and withdrawals"
Developer writes:
  INSERT events (type, aggregateId, payload, version)
  VALUES ('MoneyDeposited', 123, '{"amount": 100}', 2);

Mental model: Events are truth. The row is a CACHE of events.
```

### The Aggregate Boundary

An aggregate is a consistency boundary. All operations within an aggregate are atomic.

```
Account Aggregate:

  Events: [AccountCreated, MoneyDeposited, MoneyWithdrawn, ...]
  
  Invariants checked during replay:
    - balance >= 0 (no overdraft)
    - version increments by 1 (no concurrent writes)
```

### Temporal Queries

Event sourcing makes time a first-class concept:

```typescript
// What is the current balance?
const current = replay(allEvents);

// What was the balance on March 15th?
const historical = replay(events.filter(e => e.timestamp < '2024-03-16'));

// How many withdrawals in the last 30 days?
const withdrawals = events.filter(e => 
  e.type === 'MoneyWithdrawn' && 
  e.timestamp > thirtyDaysAgo
);
```

### Rebuild vs Update

The hardest habit to break: DON'T update state directly.

```
WRONG Habit:
  1. Read current state from cache
  2. Mutate cache directly
  3. Append event as an afterthought

RIGHT Habit:
  1. Read current state by replaying events
  2. Validate business rules against replayed state
  3. Append new event
  4. State is a side effect of the event
```

### Snapshot Thinking

Replaying 1M events is slow. Snapshots are a performance optimization, not a source of truth.

```
Pure Event Sourcing (slow):
  state = replay(allEvents)  // O(n)

With Snapshots (fast):
  snapshot = loadSnapshot()          // O(1)
  recentEvents = getEventsAfter(snapshot.version)  // O(100)
  state = replay(snapshot.state, recentEvents)     // O(100)
```

The snapshot can be deleted and regenerated at any time. It is disposable. The event log is sacred.
