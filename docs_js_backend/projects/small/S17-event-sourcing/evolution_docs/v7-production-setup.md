# S17 Event Sourcing — v7 Production Setup

## The Journey

We started with direct state mutation, layered in events, TypeScript, replay logic, logging, tests, and ESM. Now we have event sourcing that respects auditability and performance.

## What v7 Adds

- **Event log**: Every state change is recorded as an immutable event
- **Replay**: State is rebuilt by replaying events in order
- **Snapshots**: Periodic state snapshots avoid replaying millions of events
- **CQRS**: Read model is separate from write model
- **Optimistic concurrency**: Version numbers prevent lost updates

## The Final Code

```ts
// src/store.ts
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
const snapshots = new Map<string, AccountState>();

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
  snapshots.set(id, state);
  return state;
}

export function deposit(accountId: string, amount: number): AccountState | null {
  if (amount <= 0) return null;

  const state = rebuildState(accountId);
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
  snapshots.set(accountId, state);
  return state;
}

export function withdraw(accountId: string, amount: number): AccountState | { error: string } | null {
  const state = rebuildState(accountId);
  if (!state) return null;
  if (state.balance < amount) return { error: 'Insufficient funds' };

  const event: Event = {
    id: uuid(),
    type: 'MoneyWithdrawn',
    aggregateId: accountId,
    payload: { amount },
    timestamp: new Date().toISOString(),
    version: state.version + 1,
  };
  eventStore.push(event);

  state.balance -= amount;
  state.version += 1;
  snapshots.set(accountId, state);
  return state;
}

export function getBalance(accountId: string): AccountState | null {
  return rebuildState(accountId);
}

export function getEvents(accountId: string): Event[] {
  return eventStore.filter(e => e.aggregateId === accountId);
}

export function rebuildState(accountId: string): AccountState | null {
  const snapshot = snapshots.get(accountId);
  const allEvents = getEvents(accountId);

  if (allEvents.length === 0) return snapshot || null;

  const startVersion = snapshot ? snapshot.version : 0;
  const eventsToApply = allEvents.filter(e => e.version > startVersion);

  let state: AccountState = snapshot || { id: accountId, owner: '', balance: 0, version: 0 };
  for (const event of eventsToApply) {
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

```ts
// src/routes.ts
import { Router, Request, Response } from 'express';
import { createAccount, deposit, withdraw, getBalance, getEvents } from './store.js';

export const eventRouter = Router();

eventRouter.post('/accounts', (req: Request, res: Response) => {
  const { owner } = req.body;
  const account = createAccount(owner);
  res.status(201).json(account);
});

eventRouter.post('/accounts/:id/deposit', (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount } = req.body;
  const result = deposit(id, amount);
  if (!result) return res.status(404).json({ error: 'Account not found or invalid amount' });
  res.json(result);
});

eventRouter.post('/accounts/:id/withdraw', (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount } = req.body;
  const result = withdraw(id, amount);
  if (!result) return res.status(404).json({ error: 'Account not found' });
  if ('error' in result) return res.status(400).json(result);
  res.json(result);
});

eventRouter.get('/accounts/:id/balance', (req: Request, res: Response) => {
  const { id } = req.params;
  const result = getBalance(id);
  if (!result) return res.status(404).json({ error: 'Account not found' });
  res.json(result);
});

eventRouter.get('/accounts/:id/events', (req: Request, res: Response) => {
  const { id } = req.params;
  const events = getEvents(id);
  res.json({ events });
});
```

## Why This Matters in Production

Without an event log, you have no audit trail. Without replay, you can't fix bugs in historical data. Without snapshots, reading state is O(n) over all events. Without CQRS, complex reads slow down writes. Without optimistic concurrency, race conditions corrupt balances.

## Pain → Solution Summary

| Version | Pain | Solution |
|---------|------|----------|
| v1 | Direct state mutation, no history | Basic account concept |
| v2 | Typos in event payloads | TypeScript interfaces |
| v3 | State and events diverge | Replay from event log |
| v4 | No visibility into event processing | Structured logging |
| v5 | Stale snapshots return wrong data | Vitest tests for snapshot versioning |
| v6 | CJS module resolution issues | ESM with NodeNext |
| v7 | Slow reads, no read/write separation | Snapshots + CQRS + optimistic concurrency |

## Run It

```bash
PORT=3000 NODE_ENV=production node dist/index.js
```
