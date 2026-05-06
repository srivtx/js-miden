# S17 Event Sourcing — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Without validation, your API accepts anything:

```bash
curl -X POST http://localhost:3000/events/accounts/123/deposit -H "Content-Type: application/json" -d '{"amount": -100}'
curl http://localhost:3000/events/accounts/123/balance
```

Your endpoints:
- Accept negative deposits → balance decreases
- Skip event validation → corrupted event store
- Mutate state directly → events and state diverge

## The Fix: Replay from Events

```ts
// store.ts
export function deposit(accountId: string, amount: number): AccountState | null {
  if (amount <= 0) return null; // validation

  const state = accountState.get(accountId);
  if (!state) return null;

  const event: Event = {
    id: uuid(),
    type: 'MoneyDeposited',
    aggregateId: accountId,
    payload: { amount },
    timestamp: new Date().toISOString(),
    version: state.version + 1,
  };
  eventStore.push(event);
  // Still mutating directly — BUG! Should replay.
  state.balance += amount;
  state.version += 1;
  return state;
}

// Correct approach: rebuild state from events
export function rebuildState(accountId: string): AccountState | null {
  const events = getEvents(accountId);
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

**What this prevents:**
- Negative deposits via validation
- Direct state mutation via replay
- Event/state divergence

## The Pain That Remains

Replaying 1,000,000 events to get the current balance takes 5 seconds. Every read is slow. You need snapshots.

## What v4 Fixes

Logging. Production without logs is flying blind.
