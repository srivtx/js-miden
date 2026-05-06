# v3 — Add Validation (Blockchain)

## The Scenario

It's 2am. Your junior added TypeScript. "No more typos!" they celebrate. Then a client sends `POST /transactions` with `{ from: 'not-an-address', value: '-100', gasPrice: '0' }` and the API stores it. TypeScript didn't help — the runtime data was wrong.

## The PAIN: TypeScript Doesn't Validate Runtime Data

From v2:

```typescript
app.post('/transactions', (req: Request, res: Response) => {
  const input: CreateTransactionInput = req.body; // Type assertion = TRUST
  // Client sends: { from: 'not-an-address', value: '-100', gasPrice: '0' }
  // TypeScript believes it's valid. The transaction is invalid.
});
```

TypeScript is a compile-time guard. At runtime, `req.body` is whatever the client sent. A type assertion (`as CreateTransactionInput`) is a lie we tell the compiler.

### Real bugs from production:

```json
// Client sends:
{ "from": "not-an-address", "to": "0xrecipient", "value": "-100" }
// Invalid address format. Negative value. The node rejects it after broadcast.

{ "gasPrice": "0", "gasLimit": "21000" }
// Zero gas price. Transaction sits in mempool forever. User funds locked.

{ "nonce": -1 }
// Negative nonce. The nonce manager breaks. Transaction ordering fails.
```

## The Solution: Zod Schema Validation

```typescript
// src/routes/transaction.ts
import { z } from 'zod';

const hexStringSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid Ethereum address');

const transactionSchema = z.object({
  from: hexStringSchema,
  to: hexStringSchema,
  value: z.string().regex(/^\d+$/, 'Must be a non-negative integer'),
  gasPrice: z.string().regex(/^[1-9]\d*$/, 'Gas price must be positive'),
  gasLimit: z.string().regex(/^[1-9]\d*$/, 'Gas limit must be positive'),
});
```

```typescript
app.post('/transactions', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = transactionSchema.parse(req.body);
    // ^ Zod validates AND transforms. parsed is guaranteed to match the schema.
    const tx = createTransaction(parsed);
    res.status(201).json(tx);
  } catch (err) {
    next(err); // Goes to error handler
  }
});
```

### What Zod catches:

| Input | TypeScript alone | Zod validation |
|-------|---------------|----------------|
| `{ from: 'not-an-address' }` | ❌ Accepts via assertion | **Error**: Must be a valid Ethereum address |
| `{ value: '-100' }` | ❌ Accepts | **Error**: Must be a non-negative integer |
| `{ gasPrice: '0' }` | ❌ Accepts zero | **Error**: Gas price must be positive |
| `{ nonce: -1 }` | ❌ Accepts negative | **Error**: Number must be greater than or equal to 0 |
| `{ to: '0xabc' }` | ❌ Accepts short | **Error**: Must be a valid Ethereum address |

## The PAIN of Naive Validation

```typescript
// The "I'll write it myself" approach (DON'T)
function validateTransaction(body: any) {
  if (!body.from) throw new Error('From required');
  if (!body.to) throw new Error('To required');
  // ... 50 more lines for every field
  // Forgot to check address format? Invalid transactions broadcast.
  // Forgot to validate gasPrice > 0? Transactions stuck in mempool.
}
```

Hand-rolled validation is:
- **Verbose**: 50 lines vs 10 lines of Zod
- **Inconsistent**: One endpoint checks addresses, another doesn't
- **Untyped**: The "validated" output is still `any`

## The Zod Advantage: Types from Schemas

```typescript
// Derive TypeScript types FROM the schema (single source of truth)
type CreateTransactionInput = z.infer<typeof transactionSchema>;
// Equivalent to: { from: string; to: string; value: string; gasPrice: string; gasLimit: string }
```

Now your TypeScript types and runtime validators are **the same thing**. Change the schema? Both update automatically.

## Validation Evolution in the Blockchain

| Version | Validation | What breaks |
|---------|-----------|-------------|
| v1 (JS) | None | Everything |
| v2 (TS) | Type assertions | Invalid transactions broadcast |
| v3 (Zod) | Schema parsing | Nothing (caught at boundary) |

## The Realization

> Junior: "Zod rejected a request with `from: 'not-an-address'`. The error message even said 'Must be a valid Ethereum address'."
>
> You: "That's the difference. TypeScript tells *you* about typos. Zod tells *users* about their mistakes. Both are necessary. In a blockchain, one invalid transaction can waste gas, lock funds, or break nonce ordering."

## The Next PAIN

Validation catches user bugs, but what about **your** bugs? What happens when the nonce manager throws because of a race condition? What happens when an unhandled promise rejection crashes the process during a block validation?

## Next: v4 — Add Logging
