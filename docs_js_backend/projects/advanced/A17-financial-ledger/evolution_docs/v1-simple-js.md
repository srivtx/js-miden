# v1 — Simple JS (Naive Financial Ledger)

## The Scenario

It's 2am. Your junior just deployed their first financial ledger. "It tracks transactions!" they say. You ask if it uses double-entry bookkeeping. They say "what's that?" You ask about floating-point precision. They say "JavaScript has numbers."

## The PAIN: Single-Entry, Floating-Point, Mutable History

```javascript
// server.js
const express = require('express');
const app = express();
app.use(express.json());

const accounts = {}; // <-- The ledger. One object. No audit trail.

app.post('/transaction', (req, res) => {
  const { from, to, amount } = req.body;

  if (!accounts[from]) accounts[from] = { balance: 0 };
  if (!accounts[to]) accounts[to] = { balance: 0 };

  // Single-entry: we only subtract from 'from' and add to 'to'
  // No journal. No debits and credits. No balance verification.
  accounts[from].balance -= amount;
  accounts[to].balance += amount;

  res.json({ from: accounts[from], to: accounts[to] });
});

app.post('/adjust', (req, res) => {
  // Wait... we can just edit balances directly?
  const { account, newBalance } = req.body;
  accounts[account].balance = newBalance;
  res.json({ success: true });
});

app.listen(3000);
```

### What breaks in production:

1. **Floating-point errors**: `accounts['alice'].balance = 0.1 + 0.2` evaluates to `0.30000000000000004`. At scale, these errors compound. Your ledger is out of balance by millions of dollars.

2. **No double-entry**: Every transaction should have equal debits and credits. Here, we just move a number. If a bug only subtracts from `from` but fails to add to `to`, money disappears. You have no way to detect the imbalance.

3. **Mutable history**: The `/adjust` endpoint lets anyone rewrite any balance. An admin "adjusts" the CEO's account by $1,000,000. There is no audit trail. There is no immutable log.

4. **No multi-currency**: `amount` is just a number. Is it USD? EUR? BTC? You convert JPY to USD by dividing by the exchange rate using floating-point math. The error is 0.0001. At $1B volume, that's $100,000 lost to rounding.

5. **Data loss on restart**: The `accounts` object lives in RAM. Deploy a new version? Every balance resets to zero. Your CFO has a heart attack.

### The moment of realization:

> Junior: "Why is the ledger out of balance by $0.00000000000001? And why can I just edit balances directly?"
>
> You: "Because you used floating-point math for money. Because you built a spreadsheet, not a ledger. A financial ledger is append-only, double-entry, and auditable. You built a JavaScript object that anyone can mutate."

## Why we start here

This is how developers build their first financial system. It's simple. It moves numbers. And it's completely unsuitable for any real accounting. We keep this version to remember the pain — so we understand why double-entry bookkeeping, integer-based money, and immutable audit trails exist.

## The fix (next version)

We need types to prevent `req.body.amout` from being silently treated as `undefined`. But more importantly, we need **integer-based money** and **double-entry structure** — because in finance, `0.1 + 0.2 !== 0.3` is not a joke, it's a lawsuit.
