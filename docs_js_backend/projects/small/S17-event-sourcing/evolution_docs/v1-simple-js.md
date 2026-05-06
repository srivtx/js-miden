# S17 Event Sourcing — v1 Simple JS

## The Naive Beginning

You need to track account state. The simplest thing: direct state updates.

```js
// server.js
const express = require('express');
const app = express();
app.use(express.json());

const accounts = new Map();

app.post('/accounts', (req, res) => {
  const id = Math.random().toString(36);
  accounts.set(id, { id, owner: req.body.owner, balance: 0 });
  res.status(201).json(accounts.get(id));
});

app.post('/accounts/:id/deposit', (req, res) => {
  const account = accounts.get(req.params.id);
  account.balance += req.body.amount;
  res.json(account);
});

app.post('/accounts/:id/withdraw', (req, res) => {
  const account = accounts.get(req.params.id);
  account.balance -= req.body.amount;
  res.json(account);
});

app.get('/accounts/:id/balance', (req, res) => {
  res.json(accounts.get(req.params.id));
});

app.listen(3000);
```

**"This works. Direct state is simple. Ship it."**

## The Pain in Production

### 1. No Audit Trail

A user's balance is wrong. Was it a bug? Fraud? A race condition? You have no record of what happened. You can't debug. You can't comply with regulations.

### 2. No Replay

You discover a bug in your interest calculation. You fix it. But you can't recalculate past balances. The incorrect data is baked in forever.

### 3. Race Conditions

Two withdrawals happen simultaneously. Both read balance=100. Both subtract 80. Both write balance=20. You allowed -60 overdraft. Data is corrupted.

### 4. No Temporal Queries

"What was the balance on March 15th?" You don't know. You only store current state. Historical questions are impossible.

## What We Have

- **Direct state mutation** — no history, no audit
- **No event log** — can't replay or debug
- **No concurrency control** — race conditions corrupt data
- **No snapshots** — replaying 1M events is slow

## What v2 Fixes

Event log. Store every state change as an event.
