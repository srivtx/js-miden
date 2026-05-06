# S17 Event Sourcing — v4 Add Logging

## The Bug: Production Visibility Crisis

You deploy v3. Support ticket arrives: *"The balance is wrong."*

You check the code. It looks correct. You have zero visibility into:

- What events were stored?
- What was the order of events?
- Did a replay produce a different result?
- Was there a race condition?

```ts
// Without logging — silent corruption
export function deposit(accountId: string, amount: number) {
  const event = { type: 'MoneyDeposited', payload: { amount } };
  eventStore.push(event);
  state.balance += amount;
}
```

## The Fix: Structured Logging

```ts
// store.ts
import { logger } from './logger.js';

export function deposit(accountId: string, amount: number): AccountState | null {
  if (amount <= 0) {
    logger.warn({ accountId, amount }, 'Invalid deposit amount');
    return null;
  }

  const state = accountState.get(accountId);
  if (!state) {
    logger.warn({ accountId }, 'Account not found');
    return null;
  }

  const event: Event = {
    id: uuid(),
    type: 'MoneyDeposited',
    aggregateId: accountId,
    payload: { amount },
    timestamp: new Date().toISOString(),
    version: state.version + 1,
  };
  eventStore.push(event);

  logger.info({ eventId: event.id, accountId, amount, version: event.version }, 'Event stored');

  state.balance += amount;
  state.version += 1;
  return state;
}

export function rebuildState(accountId: string): AccountState | null {
  const events = getEvents(accountId);
  logger.debug({ accountId, eventCount: events.length }, 'Rebuilding state');

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

  logger.info({ accountId, balance: state.balance, version: state.version }, 'State rebuilt');
  return state;
}
```

Now your logs tell the story:
```json
{"level":"info","eventId":"abc","accountId":"123","amount":100,"version":2,"msg":"Event stored"}
{"level":"debug","accountId":"123","eventCount":1000000,"msg":"Rebuilding state"}
{"level":"info","accountId":"123","balance":5000,"version":1000000,"msg":"State rebuilt"}
```

Wait — rebuilding 1,000,000 events takes 5 seconds. The log reveals the missing snapshot bug.

## The Pain That Remains

You add snapshotting but forget to handle the case where a snapshot is stale (newer events exist after it). Your test with no new events passes, but the stale snapshot case returns old data. No test caught it.

## What v5 Fixes

Testing. Silent breakage when adding features is unacceptable.
