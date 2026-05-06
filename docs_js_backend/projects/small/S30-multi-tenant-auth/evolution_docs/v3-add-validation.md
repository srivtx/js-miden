# v3-add-validation

## Goal
Validate auth payloads and tenant identifiers before DB access.

## Changes
1. `zod` schema for register and login.
2. Tenant ID regex (`[a-z0-9_-]{1,32}`).
3. Password minimum length (8).
4. Email format validation.

## Code

```ts
// src/validation.ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
});
```

```ts
// src/controller.ts
import { registerSchema, loginSchema } from './validation.js';

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const user = await registerUser(parsed.data.email, parsed.data.password, parsed.data.tenantId);
  return res.status(201).json(user);
}
```

## Decisions
- Tenant ID regex prevents SQL injection and path traversal in schema names.
- Password min length at the edge; complexity rules (upper, lower, number) can be added later.

## Risks
- `tenantId` regex does not prevent a non-existent schema from causing a 500. Handle gracefully.
