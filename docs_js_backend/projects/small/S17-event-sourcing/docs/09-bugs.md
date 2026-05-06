# 09-bugs.md

## WHAT

Two intentional bugs demonstrate common event sourcing mistakes.

## WHY

Direct state updates and missing snapshots defeat the purpose of event sourcing.

## HOW

### Bug 1: Direct State Update

**Symptom**: `deposit()` and `withdraw()` mutate `accountState` directly.

**Impact**: If events are manually corrected (e.g., fraud reversal), the direct state doesn't reflect changes.

**Fix**: Always rebuild state from events:

```typescript
export function deposit(accountId: string, amount: number): AccountState | null {
  const state = rebuildState(accountId); // Rebuild from events
  if (!state) return null;
  
  const event: Event = {
    type: 'MoneyDeposited',
    aggregateId: accountId,
    payload: { amount },
    version: state.version + 1,
    // ...
  };
  appendEvent(event);
  return rebuildState(accountId); // Return rebuilt state
}
```

### Bug 2: No Snapshotting

**Symptom**: Replaying 100 events takes measurable time.

**Impact**: With 1M events, reads become unusably slow.

**Fix**: Implement snapshotting and replay only events after the snapshot.
