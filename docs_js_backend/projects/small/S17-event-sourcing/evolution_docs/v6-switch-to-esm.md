# S17 Event Sourcing — v6 Switch to ESM

## The Bug: CommonJS is Legacy

Your project uses `require()` and `module.exports`:

```js
// CommonJS — works, but dated
const express = require('express');
const { v4: uuid } = require('uuid');

module.exports = { createAccount, deposit };
```

**Problems:**
1. No top-level await
2. `require()` loads synchronously and caches aggressively
3. Named exports are fragile
4. Modern packages ship ESM-only
5. `__dirname` and `__filename` are CJS-only

## The Fix: ESM

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

```ts
// src/index.ts
import express from 'express';
import { eventRouter } from './routes.js';

const app = express();
app.use(express.json());
app.use('/events', eventRouter);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

export { app };
```

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

export function getEvents(accountId: string): Event[] {
  return eventStore.filter(e => e.aggregateId === accountId);
}

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

**What ESM gives you:**
- Static analysis
- Explicit file extensions
- Modern Node.js alignment

## The Pain That Remains

You have TypeScript, event storage, replay, logging, tests, and ESM. But reads and writes use the same model. A complex query scanning all accounts slows down event writes. You need CQRS.

## What v7 Fixes

Final production setup. Snapshots for fast reads, CQRS for read/write separation, and proper event versioning.
