# v1 — Simple JS (Naive Blockchain)

## The Scenario

It's 2am. Your junior just deployed their first blockchain backend. "It sends coins!" they say. You ask about nonces. They think you mean the word for "not once." You ask about double-spends. They shrug.

## The PAIN: Mutable Ledger, No Cryptography

```javascript
// server.js
const express = require('express');
const app = express();
app.use(express.json());

const balances = {}; // <-- The "ledger". One object. Mutable. Fragile.
const transactions = []; // <-- The "history". Until restart.

app.post('/send', (req, res) => {
  const { from, to, amount } = req.body;

  if (!balances[from]) balances[from] = 1000; // Free money on first use!
  if (!balances[to]) balances[to] = 0;

  if (balances[from] < amount) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  balances[from] -= amount;
  balances[to] += amount;

  transactions.push({ from, to, amount, timestamp: new Date() });
  res.json({ success: true, balances });
});

app.post('/reverse', (req, res) => {
  // Wait... we can just reverse transactions?
  const tx = transactions.find(t => t.id === req.body.txId);
  if (tx) {
    balances[tx.from] += tx.amount;
    balances[tx.to] -= tx.amount;
    tx.reversed = true;
  }
  res.json({ success: true });
});

app.listen(3000);
```

### What breaks in production:

1. **Double-spend**: Two concurrent requests send the same balance. Both read `balances[from] = 100`. Both subtract 100. Both succeed. Alice sent 100 to Bob and 100 to Charlie with only 100 in her account.

2. **No cryptographic identity**: `from` is just a string. Anyone can send from any address. There are no private keys, no signatures, no proof of ownership.

3. **Mutable history**: The `/reverse` endpoint lets an admin undo transactions. The DAO hack taught us: if history can be rewritten, trust evaporates.

4. **No nonces**: Replaying the same transaction creates the same transfer again and again. An attacker captures a valid request and replays it 1000 times.

5. **Data loss on restart**: The `balances` object lives in RAM. Deploy a new version? Everyone's balance resets to zero. The "blockchain" is just a variable.

### The moment of realization:

> Junior: "Why did Alice's balance go negative? And why can I reverse transactions?"
>
> You: "Because you built a shared spreadsheet, not a blockchain. A blockchain is immutable, cryptographically signed, and deterministic. You built a JavaScript object that anyone can edit."

## Why we start here

This is how developers build their first "blockchain" if they don't understand the primitives. It's simple. It moves numbers between keys. And it's completely unsuitable for any trustless system. We keep this version to remember the pain — so we understand why immutability, signatures, and nonce management exist.

## The fix (next version)

We need types to prevent `req.body.amont` from being silently treated as `undefined`. But more importantly, we need **cryptographic wallets** and **nonce tracking** — because in a blockchain, math replaces trust.
