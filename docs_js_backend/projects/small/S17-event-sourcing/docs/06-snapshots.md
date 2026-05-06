# 06-snapshots.md

## WHAT

Snapshots cache aggregate state at a specific version to avoid replaying all events.

## WHY

Replaying 1M events on every read is slow. Snapshots allow starting from a known state.

## HOW

```typescript
interface Snapshot {
  aggregateId: string;
  state: AccountState;
  version: number;
  timestamp: string;
}

function getState(accountId: string): AccountState {
  const snapshot = getLatestSnapshot(accountId);
  const events = getEventsAfter(accountId, snapshot?.version || 0);
  
  let state = snapshot?.state || initialState();
  for (const event of events) {
    state = applyEvent(state, event);
  }
  
  if (events.length > 100) {
    saveSnapshot(accountId, state);
  }
  
  return state;
}
```
