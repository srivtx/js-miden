# v2 — Add TypeScript (Financial Ledger)

## The Scenario

It's 2am. Your junior just spent 3 hours debugging why a transaction won't post. "JavaScript doesn't care," they mutter. The code reads `req.body.amout` instead of `req.body.amount`. The debit is `undefined`. The ledger is out of balance. You hand them TypeScript.

## The PAIN: Dynamic Typing in Financial Systems

From v1, we had this bug:

```javascript
app.post('/transaction', (req, res) => {
  const { from, to, amout } = req.body; // <-- typo
  accounts[from].balance -= amout; // undefined subtracted = NaN
  accounts[to].balance += amout;   // undefined added = NaN
  res.json({ from: accounts[from], to: accounts[to] }); // NaN everywhere
});
```

This compiles. Runs. Subtracts `undefined` from a balance. The result is `NaN`. Every subsequent operation on that account produces `NaN`. The ledger is corrupted beyond repair.

### More typos that bite you:

```javascript
// Wrong property access
entry.debitAcount // undefined (real property is 'debitAccount')

// Currency code typo
tx.currency = 'US' // No error. Just a currency that doesn't exist.

// Date as string
entry.date = '2024-13-45' // Invalid date. No error until reconciliation fails.
```

These runtime errors happen in production. Ledgers become unbalanced. Audits fail. At 2am, before the quarterly close.

## The Solution: TypeScript

```typescript
// src/types/transaction.types.ts
export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parentId?: string;
  createdAt: Date;
}

export interface JournalEntry {
  id: string;
  date: Date;
  description: string;
  lines: JournalLine[];
  hash: string;
  previousHash: string;
  createdAt: Date;
}

export interface JournalLine {
  accountId: string;
  debit: number; // in smallest currency unit (cents, satoshis)
  credit: number;
  currency: string; // 'USD', 'EUR', 'BTC'
}
```

```typescript
// src/controllers/transaction.controller.ts
import type { JournalEntry, CreateJournalEntryInput } from '../types/transaction.types.js';

export function postTransaction(req: Request, res: Response) {
  const input: CreateJournalEntryInput = req.body;
  // ^ TypeScript knows 'amount' is required, 'amout' is an error

  const entry: JournalEntry = {
    id: crypto.randomUUID(),
    date: new Date(input.date),
    description: input.description,
    lines: input.lines.map(line => ({
      accountId: line.accountId,
      debit: line.debit,
      credit: line.credit,
      currency: line.currency,
    })),
    hash: '',
    previousHash: '',
    createdAt: new Date(),
  };

  entries.push(entry);
  res.status(201).json(entry);
}
```

### What TypeScript catches at compile time:

| Bug | JavaScript | TypeScript |
|-----|-----------|------------|
| `req.body.amout` | Runtime `undefined` → NaN | **Compile error**: Property 'amout' does not exist |
| `entry.debitAcount` | Runtime `undefined` | **Compile error**: Property 'debitAcount' does not exist |
| `currency: 'US'` | Runtime accepted | **Compile error**: Type '"US"' not assignable |
| Missing `lines` field | Runtime `undefined` | **Compile error**: Property 'lines' is missing |
| `debit: "100"` | Runtime string | **Compile error**: Type 'string' not assignable to 'number' |

## The New PAIN: Any Types

```typescript
// The lazy way (DON'T DO THIS)
app.post('/transaction', (req: Request, res: Response) => {
  const entry = req.body as any; // "I don't care about types"
  entries.push(entry); // accepts literally anything
});
```

Using `as any` defeats the purpose. It's like accepting any number format because "accounting will figure it out."

## The Realization

> Junior: "TypeScript caught `amout` before I deployed. That typo would have corrupted the entire ledger with NaN."
>
> You: "That's not a bug — that's TypeScript doing its job. In a financial ledger, a typo in a transaction field doesn't just break one record — it poisons every balance calculation downstream."

## Why this matters for the Financial Ledger

Our data model is strictly hierarchical:
- v1: `{ from, to, amount }`
- v2: `{ id, date, description, lines: [{ accountId, debit, credit, currency }], hash, previousHash }`

Without types, you add `currency` to the journal line but forget it in the balance calculation. With types, the compiler reminds you: *"Hey, JournalLine.currency exists, but your balance function ignores it."*

But TypeScript only catches **developer** bugs. It does nothing when a **user** sends `{ debit: -100, credit: 50 }` or `{ currency: 'USD', amount: 0.1 + 0.2 }`. For that, we need validation.

## Next: v3 — Add Validation
