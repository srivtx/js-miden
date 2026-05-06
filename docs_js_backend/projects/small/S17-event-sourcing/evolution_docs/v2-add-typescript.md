# S17 Event Sourcing — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You add an event log:

```js
const events = [];

app.post('/accounts/:id/deposit', (req, res) => {
  const account = accounts.get(req.params.id);
  events.push({ type: 'Deposit', accountId: req.params.id, amount: req.body.amount });
  account.balance += req.body.amount;
  res.json(account);
});
```

**The bug:** `req.body.amount` might be a string. `"100" + 50 = "10050"` (string concatenation) instead of `150` (addition). JavaScript coerces silently. Your balance becomes garbage.

Another bug: you treat `events` as an in-memory array. Restart the server? All events are gone. The state is unrecoverable.

## The Fix: Add TypeScript

```ts
// store.ts
import { v4 as uuid } from 'uuid';

interface Event {
  id: string;
  type: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  timestamp: string;
  version: number;
}

interface AccountState {
  id: string;
  owner: string;
  balance: number;
  version: number;
}

const eventStore: Event[] = [];
const accountState: Map<string, AccountState> = new Map();

export function createAccount(owner: string): AccountState {
  const id = uuid();
  const event: Event = {
    id: uuid(),
    type: 'AccountCreated',
    aggregateId: id,
    payload: { owner },
    timestamp: new Date().toISOString(),
    version: 1,
  };
  eventStore.push(event);
  const state: AccountState = { id, owner, balance: 0, version: 1 };
  accountState.set(id, state);
  return state;
}

export function deposit(accountId: string, amount: number): AccountState | null {
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
  state.balance += amount;
  state.version += 1;
  return state;
}
```

Now `tsc` errors on:
```
store.ts:45:28 - error TS2322: Type 'string' is not assignable to type 'number'.
```

## But TypeScript Doesn't Catch Everything

TypeScript validates **compile-time** shapes, not **runtime** logic. A client can still:
- Mutate state directly without events
- Skip event persistence
- Create race conditions
- Fail to replay events

We need event-driven state reconstruction.

> **Lesson:** TypeScript eliminates typos and wrong shapes. But event sourcing requires that ALL state changes go through events.

## What v3 Fixes

Replay. Rebuild state from the event log instead of direct mutation.
