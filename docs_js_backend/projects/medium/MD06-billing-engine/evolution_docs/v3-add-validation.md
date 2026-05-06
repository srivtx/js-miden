# MD06 Billing Engine — v3 Add Validation

> **Motto**: Trust no payload, especially one with a dollar sign.

## What Changed

Added `zod` schemas for every inbound request. Validation runs before any Stripe call. Invalid amounts, currencies, or missing fields return `400` with a clear error message.

## Why

- **Stripe errors are opaque**: A negative amount returns a generic `parameter_invalid_integer` — our schema tells the user exactly which field failed
- **Security**: Prevents injection via `metadata` or `description` fields
- **Contract**: The zod schema *is* the API contract; frontend and backend agree

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│     Zod         │─────▶│    Express      │─────▶│     Stripe      │
│  (Checkout) │◀─────│  (validate)     │◀─────│   Handler       │◀─────│   API           │
└─────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘
                            │
                            ▼ (400 Bad Request)
                     ┌─────────────────┐
                     │  Clear error    │
                     │  { field, msg } │
                     └─────────────────┘
```

## Code

```typescript
// src/validators/charge.ts
import { z } from 'zod';

export const chargeSchema = z.object({
  amount: z.number().int().positive().max(999_999_99),
  currency: z.string().length(3).toLowerCase(),
  customerEmail: z.string().email().optional(),
  paymentMethodId: z.string().startsWith('pm_').optional(),
  metadata: z.record(z.string().max(500)).optional(),
});

export type ChargeInput = z.infer<typeof chargeSchema>;

// src/middleware/validate.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        issues: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

// src/server.ts
import { chargeSchema } from './validators/charge.js';
import { validateBody } from './middleware/validate.js';

app.post('/charge', validateBody(chargeSchema), async (req, res) => {
  const { amount, currency, customerEmail, paymentMethodId } = req.body;
  // ... Stripe call
});
```

## Decisions

**Option A: Joi**
- Pros: Mature, expressive error messages
- Cons: Larger bundle, different syntax

**Option B: Zod**
- Pros: Native TypeScript inference, smaller footprint, great DX
- Cons: Slightly less flexible custom messages (solved in v3.22+)

**Chosen: Zod** — inferring `ChargeInput` from the schema eliminates drift between validator and type.

## Problems We Accepted

- Validation is only on the happy-path fields; webhook payloads are still unvalidated
- No idempotency key validation (it exists, but we don't enforce format yet)
- Logging is still `console.log`

## Checklist

- [ ] Every `POST` / `PUT` route has a zod schema
- [ ] `amount` is bounded (prevents integer overflow and absurd charges)
- [ ] `currency` is 3-letter ISO code
- [ ] Validation middleware runs *before* auth (fail fast on garbage)

## Next Step

Add structured logging so we can trace a charge from request to Stripe response.
