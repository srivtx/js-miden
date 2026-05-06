# 03-CONCEPTS.md

## WHAT: Event Sourcing Core Concepts

### Event

An event is an immutable fact representing something that happened in the past.

```typescript
// WHAT: An event records a state change
// WHY: Facts are immutable and timeless
// HOW: Append to event store, never update or delete

interface Event {
  id: string;              // Unique event ID
  type: string;            // Domain event type
  aggregateId: string;     // Entity this event belongs to
  payload: Record<string, unknown>;  // Event data
  timestamp: string;       // ISO-8601 occurrence time
  version: number;         // Optimistic concurrency control
}

// Example events:
{ type: 'AccountCreated',    payload: { owner: 'Alice' } }
{ type: 'MoneyDeposited',    payload: { amount: 100 } }
{ type: 'MoneyWithdrawn',    payload: { amount: 50 } }
```

### Event Store

```
Append-Only Log:

  Index  Event                    Aggregate  Version
  -----  -----                    ---------  -------
  0      AccountCreated(Alice)    acc-123    1
  1      MoneyDeposited(100)      acc-123    2
  2      MoneyDeposited(25)       acc-456    1
  3      MoneyWithdrawn(50)       acc-123    3
  4      MoneyDeposited(200)      acc-456    2
  
  // Time flows down. Newest events at the bottom.
  // Queries filter by aggregateId.
```

### State Rebuild (Replay)

```typescript
// WHAT: Compute current state by applying all events in order
// WHY: State is derived, not stored
// HOW: Fold events over an initial state

export function rebuildState(accountId: string): AccountState | null {
  const events = getEvents(accountId);  // Ordered by version
  if (events.length === 0) return null;
  
  let state: AccountState = { id: accountId, owner: '', balance: 0, version: 0 };
  
  for (const event of events) {
    switch (event.type) {
      case 'AccountCreated':
        state.owner = event.payload.owner as string;
        state.version = event.version;
        break;
      case 'MoneyDeposited':
        state.balance += event.payload.amount as number;
        state.version = event.version;
        break;
      case 'MoneyWithdrawn':
        state.balance -= event.payload.amount as number;
        state.version = event.version;
        break;
    }
  }
  
  return state;
}
```

### Snapshot

```typescript
// WHAT: Cache of state at a specific version
// WHY: Avoid replaying thousands of events
// HOW: Periodically save state, then replay only newer events

interface Snapshot {
  aggregateId: string;
  state: AccountState;
  version: number;
  timestamp: string;
}

function getStateWithSnapshot(accountId: string): AccountState {
  const snapshot = getLatestSnapshot(accountId);
  const events = getEventsAfter(accountId, snapshot?.version || 0);
  
  let state = snapshot?.state || initialState(accountId);
  for (const event of events) {
    state = applyEvent(state, event);
  }
  
  // Save new snapshot if drift is large
  if (events.length > SNAPSHOT_THRESHOLD) {
    saveSnapshot(accountId, state);
  }
  
  return state;
}
```

## WHY: Direct State Update Defeats Event Sourcing

```
WRONG: Direct Mutation (The Bug in this Codebase)

Command: deposit(acc-123, 100)

1. Read state from Map: state = { balance: 50 }
2. MUTATE directly: state.balance += 100  // Now 150
3. Append event as afterthought

Result:
  - Event log says balance should be 150
  - But what if we need to reverse a fraudulent deposit?
  - We delete the event, but the Map still says 150!
  - State and event log are INCONSISTENT.
```

```
RIGHT: Rebuild from Events

Command: deposit(acc-123, 100)

1. REBUILD state from events: state = { balance: 50 }
2. Validate: 50 + 100 >= 0? Yes.
3. Append event: MoneyDeposited(100) at version 3
4. Return rebuildState(acc-123) // Fresh computation

Result:
  - Event log is sole source of truth
  - State is always consistent with events
  - Can delete/modify events and rebuild cleanly
```

## HOW: Optimistic Concurrency Control

```typescript
// Prevent lost updates in concurrent environments

function deposit(accountId: string, amount: number): Result {
  const state = rebuildState(accountId);
  
  const event: Event = {
    type: 'MoneyDeposited',
    aggregateId: accountId,
    payload: { amount },
    version: state.version + 1,  // Expected next version
    // ...
  };
  
  // Store checks: is version 3 available?
  // If another process already wrote version 3, this fails.
  appendEvent(event, expectedVersion: state.version);
}
```

## WRONG vs RIGHT: Snapshot Misuse

```typescript
// WRONG: Reading snapshot as source of truth
function getBalance(accountId: string) {
  return snapshotStore.get(accountId).balance;  // May be stale!
}

// RIGHT: Snapshot is optimization, events are truth
function getBalance(accountId: string) {
  const snapshot = loadSnapshot(accountId);
  const events = getEventsAfter(accountId, snapshot.version);
  let state = snapshot.state;
  for (const e of events) state = apply(state, e);
  return state.balance;
}
```
