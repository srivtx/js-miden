# 05-state-rebuild.md

## WHAT

State is rebuilt by replaying all events for an aggregate.

## WHY

This makes the system deterministic. Given the same events, you always get the same state.

## HOW

```typescript
export function rebuildState(accountId: string): AccountState | null {
  const events = getEvents(accountId);
  let state: AccountState = { id: accountId, owner: '', balance: 0, version: 0 };
  
  for (const event of events) {
    switch (event.type) {
      case 'AccountCreated':
        state.owner = event.payload.owner as string;
        break;
      case 'MoneyDeposited':
        state.balance += event.payload.amount as number;
        break;
      case 'MoneyWithdrawn':
        state.balance -= event.payload.amount as number;
        break;
    }
    state.version = event.version;
  }
  
  return state;
}
```
