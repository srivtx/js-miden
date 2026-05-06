# v2 — Add TypeScript (Blockchain)

## The Scenario

It's 2am. Your junior just spent 3 hours debugging why a transaction has `gasPirce` instead of `gasPrice`. "JavaScript doesn't care," they mutter. The transaction is created with `undefined` gas. The miner rejects it. You hand them TypeScript.

## The PAIN: Dynamic Typing in Cryptographic Systems

From v1, we had this bug:

```javascript
app.post('/send', (req, res) => {
  const { from, to, value, gasPirce, gasLimit } = req.body; // <-- typo
  const tx = {
    from, to, value,
    gasPrice: gasPirce, // undefined
    gasLimit,
    nonce: 0,
  };
});
```

This compiles. Runs. Stores `undefined` as gasPrice. The transaction is invalid. The user's funds are locked in a pending state forever.

### More typos that bite you:

```javascript
// Wrong property access
tx.fromAdress // undefined (real property is 'from')

// Wrong status string
tx.status = 'confrimed' // No error. Just a status that no code checks for.

// BigInt as number
const value = 9007199254740992 // Precision lost. User sends wrong amount.
```

These runtime errors happen in production. Transactions fail. Users lose funds. At 2am.

## The Solution: TypeScript

```typescript
// src/types.ts
export interface Wallet {
  id: string;
  userId: string;
  address: string;
  balance: string;
  nonce: number;
  createdAt: Date;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasLimit: string;
  nonce: number;
  status: 'pending' | 'confirmed' | 'failed';
  createdAt: Date;
}

export interface Block {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: Date;
  transactions: string[];
  miner: string;
}
```

```typescript
// src/routes/transaction.ts
import type { Transaction, CreateTransactionInput } from '../types.js';

app.post('/transactions', (req: Request, res: Response) => {
  const input: CreateTransactionInput = req.body;
  // ^ TypeScript knows 'gasPrice' is required, 'gasPirce' is an error

  const tx: Transaction = {
    hash: '0x' + Math.random().toString(16).slice(2),
    from: input.from,
    to: input.to,
    value: input.value,
    gasPrice: input.gasPrice,
    gasLimit: input.gasLimit,
    nonce: 0,
    status: 'pending',
    createdAt: new Date(),
  };

  transactions.push(tx);
  res.status(201).json(tx);
});
```

### What TypeScript catches at compile time:

| Bug | JavaScript | TypeScript |
|-----|-----------|------------|
| `req.body.gasPirce` | Runtime `undefined` | **Compile error**: Property 'gasPirce' does not exist |
| `tx.status = 'confrimed'` | Runtime accepted | **Compile error**: Type '"confrimed"' not assignable |
| `value: 9007199254740992` | Runtime precision loss | **Type error**: Should be string for BigInt safety |
| Missing `nonce` field | Runtime `undefined` | **Compile error**: Property 'nonce' is missing |
| `hash: 123` | Runtime number | **Compile error**: Type 'number' not assignable to 'string' |

## The New PAIN: Any Types

```typescript
// The lazy way (DON'T DO THIS)
app.post('/transactions', (req: Request, res: Response) => {
  const tx = req.body as any; // "I don't care about types"
  transactions.push(tx); // accepts literally anything
});
```

Using `as any` defeats the purpose. It's like skipping signature verification because "it works in testing."

## The Realization

> Junior: "TypeScript caught `gasPirce` before I deployed. That typo would have created an unminable transaction."
>
> You: "That's not a bug — that's TypeScript doing its job. In a blockchain, a typo in a transaction field can lock user funds forever."

## Why this matters for the Blockchain

Our data model is strictly cryptographic:
- v1: `{ from, to, amount }`
- v2: `{ hash, from, to, value, gasPrice, gasLimit, nonce, status, createdAt }`

Without types, you add `nonce` to the create endpoint but forget it in the broadcast logic. With types, the compiler reminds you: *"Hey, Transaction.nonce exists, but your broadcast function ignores it."*

But TypeScript only catches **developer** bugs. It does nothing when a **user** sends `{ from: 'not-an-address', value: '-100' }`. For that, we need validation.

## Next: v3 — Add Validation
