# v3 — Add Validation (Trading Engine)

## The Scenario

It's 2am. Your junior added TypeScript. "No more typos!" they celebrate. Then a trader sends `POST /orders` with `{ price: -5, quantity: 0, side: 'biy' }` and the matching engine stores it. TypeScript didn't help — the runtime data was wrong.

## The PAIN: TypeScript Doesn't Validate Runtime Data

From v2:

```typescript
app.post('/orders', (req: Request, res: Response) => {
  const input: CreateOrderInput = req.body; // Type assertion = TRUST
  // Trader sends: { symbol: 'AAPL', side: 'biy', price: -5, quantity: 0 }
  // TypeScript believes it's valid. The order book receives garbage.
});
```

TypeScript is a compile-time guard. At runtime, `req.body` is whatever the client sent. A type assertion (`as CreateOrderInput`) is a lie we tell the compiler.

### Real bugs from production:

```json
// Trader sends:
{ "symbol": "AAPL", "side": "biy", "price": -5, "quantity": 0 }
// Invalid side. Negative price. Zero quantity. The engine tries to match it.

{ "symbol": "AAPL", "side": "buy", "price": 150.123456789, "quantity": 100 }
// Sub-penny pricing violates SEC Rule 612. Compliance violation.

{ "symbol": "AAPL", "side": "buy", "price": 150, "quantity": 1000000000 }
// Billion-share order. No position limits. Could crash the engine.
```

## The Solution: Zod Schema Validation

```typescript
// src/routes/orders.ts
import { z } from 'zod';

const createOrderSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  side: z.enum(['buy', 'sell']),
  type: z.enum(['limit', 'market']),
  price: z.number().positive().max(1000000)
    .refine((p) => Number.isInteger(p * 100), {
      message: 'Price must be in whole cents (SEC Rule 612)',
    }),
  quantity: z.number().int().positive().max(10000000),
});

const orderIdSchema = z.object({
  id: z.string().uuid(),
});
```

```typescript
app.post('/orders', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createOrderSchema.parse(req.body);
    // ^ Zod validates AND transforms. parsed is guaranteed to match the schema.
    const order = createOrder(parsed);
    res.status(201).json(order);
  } catch (err) {
    next(err); // Goes to error handler
  }
});
```

### What Zod catches:

| Input | TypeScript alone | Zod validation |
|-------|---------------|----------------|
| `{ side: 'biy' }` | ❌ Accepts via assertion | **Error**: Invalid enum value |
| `{ price: -5 }` | ❌ Accepts negative | **Error**: Number must be greater than 0 |
| `{ price: 150.123 }` | ❌ Accepts | **Error**: Price must be in whole cents |
| `{ quantity: 0 }` | ❌ Accepts zero | **Error**: Number must be greater than 0 |
| `{ quantity: 1000000000 }` | ❌ Accepts | **Error**: Number must be less than or equal to 10000000 |
| `{ symbol: '' }` | ❌ Accepts empty | **Error**: String must contain at least 1 character(s) |

## The PAIN of Naive Validation

```typescript
// The "I'll write it myself" approach (DON'T)
function validateOrder(body: any) {
  if (!body.symbol) throw new Error('Symbol required');
  if (typeof body.symbol !== 'string') throw new Error('Symbol must be string');
  if (body.symbol.length > 10) throw new Error('Symbol too long');
  // ... 50 more lines for every field
  // Forgot to check sub-penny pricing? Compliance violation.
  // Forgot to check quantity is integer? Partial fills break.
}
```

Hand-rolled validation is:
- **Verbose**: 50 lines vs 8 lines of Zod
- **Inconsistent**: One endpoint checks price, another doesn't
- **Untyped**: The "validated" output is still `any`

## The Zod Advantage: Types from Schemas

```typescript
// Derive TypeScript types FROM the schema (single source of truth)
type CreateOrderInput = z.infer<typeof createOrderSchema>;
// Equivalent to: { symbol: string; side: 'buy' | 'sell'; type: 'limit' | 'market'; price: number; quantity: number }
```

Now your TypeScript types and runtime validators are **the same thing**. Change the schema? Both update automatically.

## Validation Evolution in the Trading Engine

| Version | Validation | What breaks |
|---------|-----------|-------------|
| v1 (JS) | None | Everything |
| v2 (TS) | Type assertions | Runtime garbage enters the book |
| v3 (Zod) | Schema parsing | Nothing (caught at boundary) |

## The Realization

> Junior: "Zod rejected a request with `price: -5`. The error message even said 'Number must be greater than 0'."
>
> You: "That's the difference. TypeScript tells *you* about typos. Zod tells *traders* about their mistakes. Both are necessary. In a trading engine, one invalid order can corrupt the entire book."

## The Next PAIN

Validation catches user bugs, but what about **your** bugs? What happens when the matching engine throws because of an edge case? What happens when an unhandled promise rejection crashes the process during market open?

## Next: v4 — Add Logging
