# v3 — Add Validation (Financial Ledger)

## The Scenario

It's 2am. Your junior added TypeScript. "No more typos!" they celebrate. Then a client sends `POST /transactions` with `{ debit: -100, credit: 50, currency: 'USD', amount: 0.1 + 0.2 }` and the API stores it. TypeScript didn't help — the runtime data was wrong.

## The PAIN: TypeScript Doesn't Validate Runtime Data

From v2:

```typescript
app.post('/transaction', (req: Request, res: Response) => {
  const input: CreateJournalEntryInput = req.body; // Type assertion = TRUST
  // Client sends: { debit: -100, credit: 50, currency: 'US', amount: 0.1 + 0.2 }
  // TypeScript believes it's valid. The ledger is corrupted.
});
```

TypeScript is a compile-time guard. At runtime, `req.body` is whatever the client sent. A type assertion (`as CreateJournalEntryInput`) is a lie we tell the compiler.

### Real bugs from production:

```json
// Client sends:
{ "debit": -100, "credit": 50, "currency": "US" }
// Negative debit. Imbalanced entry. Invalid currency. The ledger is out of balance.

{ "amount": 0.1, "amount2": 0.2, "total": 0.30000000000000004 }
// Floating-point error. The debits and credits don't sum to zero.

{ "lines": [] }
// Empty journal entry. No debits or credits. Meaningless transaction.
```

## The Solution: Zod Schema Validation

```typescript
// src/routes/transaction.routes.ts
import { z } from 'zod';

const currencySchema = z.enum(['USD', 'EUR', 'GBP', 'JPY', 'BTC']);

const journalLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.number().int().min(0), // in smallest currency unit
  credit: z.number().int().min(0),
  currency: currencySchema,
}).refine((line) => line.debit === 0 || line.credit === 0, {
  message: 'A line must have either debit or credit, not both',
});

const journalEntrySchema = z.object({
  description: z.string().min(1).max(500),
  lines: z.array(journalLineSchema).min(2).max(50),
}).refine((entry) => {
  const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit, 0);
  return totalDebit === totalCredit;
}, {
  message: 'Debits must equal credits (double-entry bookkeeping)',
});
```

```typescript
app.post('/transactions', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = journalEntrySchema.parse(req.body);
    // ^ Zod validates AND transforms. parsed is guaranteed to match the schema.
    const entry = createJournalEntry(parsed);
    res.status(201).json(entry);
  } catch (err) {
    next(err); // Goes to error handler
  }
});
```

### What Zod catches:

| Input | TypeScript alone | Zod validation |
|-------|---------------|----------------|
| `{ debit: -100 }` | ❌ Accepts via assertion | **Error**: Number must be greater than or equal to 0 |
| `{ currency: 'US' }` | ❌ Accepts any string | **Error**: Invalid enum value |
| `{ lines: [] }` | ❌ Accepts empty | **Error**: Array must contain at least 2 element(s) |
| Unbalanced debits/credits | ❌ Accepts | **Error**: Debits must equal credits |
| Both debit and credit > 0 | ❌ Accepts | **Error**: A line must have either debit or credit, not both |

## The PAIN of Naive Validation

```typescript
// The "I'll write it myself" approach (DON'T)
function validateEntry(body: any) {
  if (!body.lines) throw new Error('Lines required');
  if (body.lines.length < 2) throw new Error('At least 2 lines required');
  // ... 50 more lines for every field
  // Forgot to check debits === credits? Ledger out of balance.
  // Forgot to validate currency? Exchange rate lookup fails.
}
```

Hand-rolled validation is:
- **Verbose**: 50 lines vs 15 lines of Zod
- **Inconsistent**: One endpoint checks balance, another doesn't
- **Untyped**: The "validated" output is still `any`

## The Zod Advantage: Types from Schemas

```typescript
// Derive TypeScript types FROM the schema (single source of truth)
type CreateJournalEntryInput = z.infer<typeof journalEntrySchema>;
// Equivalent to: { description: string; lines: { accountId: string; debit: number; credit: number; currency: 'USD' | 'EUR' | ... }[] }
```

Now your TypeScript types and runtime validators are **the same thing**. Change the schema? Both update automatically.

## Validation Evolution in the Financial Ledger

| Version | Validation | What breaks |
|---------|-----------|-------------|
| v1 (JS) | None | Everything |
| v2 (TS) | Type assertions | Runtime garbage enters ledger |
| v3 (Zod) | Schema parsing | Nothing (caught at boundary) |

## The Realization

> Junior: "Zod rejected a transaction where debits didn't equal credits. The error message even said 'Debits must equal credits'."
>
> You: "That's the difference. TypeScript tells *you* about typos. Zod tells *accountants* their journal entry is unbalanced. Both are necessary. In a financial ledger, one unbalanced transaction corrupts every report downstream."

## The Next PAIN

Validation catches data entry errors, but what about **your** bugs? What happens when the exchange rate service throws? What happens when an unhandled promise rejection crashes the process during month-end close?

## Next: v4 — Add Logging
