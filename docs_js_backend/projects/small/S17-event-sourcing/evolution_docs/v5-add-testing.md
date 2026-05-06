# S17 Event Sourcing — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You add snapshotting:

```ts
// store.ts
const snapshots = new Map<string, AccountState>();

export function getBalance(accountId: string): AccountState | null {
  const snapshot = snapshots.get(accountId);
  if (snapshot) return snapshot; // BUG: might be stale!
  return rebuildState(accountId);
}
```

But you forget to handle stale snapshots:

```ts
// BEFORE — checks version
const snapshot = snapshots.get(accountId);
const events = getEvents(accountId);
if (snapshot && snapshot.version === events.length) return snapshot;

// AFTER — "optimization" but WRONG
if (snapshot) return snapshot; // ignores new events
```

Now new events after the snapshot are ignored. Users see old balances. You deploy. Financial data is wrong.

## The Fix: Write Tests BEFORE They Break

```ts
// tests/events.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('S17 Event Sourcing', () => {
  it('creates an account', async () => {
    const res = await request(app)
      .post('/events/accounts')
      .send({ owner: 'Alice' });
    expect(res.status).toBe(201);
    expect(res.body.owner).toBe('Alice');
    expect(res.body.balance).toBe(0);
  });

  it('deposits and updates balance', async () => {
    const create = await request(app)
      .post('/events/accounts')
      .send({ owner: 'Bob' });
    const id = create.body.id;

    const deposit = await request(app)
      .post(`/events/accounts/${id}/deposit`)
      .send({ amount: 100 });
    expect(deposit.body.balance).toBe(100);

    const balance = await request(app)
      .get(`/events/accounts/${id}/balance`);
    expect(balance.body.balance).toBe(100);
  });

  it('rejects negative deposits', async () => {
    const create = await request(app)
      .post('/events/accounts')
      .send({ owner: 'Charlie' });
    const id = create.body.id;

    const deposit = await request(app)
      .post(`/events/accounts/${id}/deposit`)
      .send({ amount: -50 });
    expect(deposit.status).toBe(400);
  });

  it('replays events correctly', async () => {
    const create = await request(app)
      .post('/events/accounts')
      .send({ owner: 'Dave' });
    const id = create.body.id;

    await request(app).post(`/events/accounts/${id}/deposit`).send({ amount: 100 });
    await request(app).post(`/events/accounts/${id}/withdraw`).send({ amount: 30 });
    await request(app).post(`/events/accounts/${id}/deposit`).send({ amount: 50 });

    const balance = await request(app).get(`/events/accounts/${id}/balance`);
    expect(balance.body.balance).toBe(120);
  });

  it('handles stale snapshots', async () => {
    const create = await request(app)
      .post('/events/accounts')
      .send({ owner: 'Eve' });
    const id = create.body.id;

    await request(app).post(`/events/accounts/${id}/deposit`).send({ amount: 100 });
    // Simulate snapshot
    snapshots.set(id, { id, owner: 'Eve', balance: 100, version: 2 });
    // New event after snapshot
    await request(app).post(`/events/accounts/${id}/deposit`).send({ amount: 50 });

    const balance = await request(app).get(`/events/accounts/${id}/balance`);
    expect(balance.body.balance).toBe(150); // not 100
  });
});
```

**What tests prevent:**
- The stale snapshot regression? Caught.
- The negative deposit bug? Caught.
- The replay correctness? Caught.
- The missing account handling? Caught.

## The Pain That Remains

Your tests run with `vitest` but you're still using `require()` and `module.exports`. Modern Node.js supports ESM natively.

## What v6 Fixes

Switch to ESM. CommonJS is legacy.
