# v3-add-validation

## Goal
Validate job payloads and prevent unknown job types from entering the queue.

## Changes
1. `zod` schema for enqueue body.
2. Whitelist allowed job types (`email`, `image`, `export`).
3. Validate payload shape per type.

## Code

```ts
// src/validation.ts
import { z } from 'zod';

export const enqueueSchema = z.object({
  type: z.enum(['email', 'image', 'export']),
  payload: z.record(z.unknown()),
});

export const emailPayloadSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});
```

```ts
// src/controller.ts
import { enqueueSchema } from './validation.js';

export async function enqueueJob(req: Request, res: Response) {
  const parsed = enqueueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const job = await addJob(parsed.data.type, parsed.data.payload);
  return res.status(201).json({ id: job.id, status: job.status });
}
```

## Decisions
- Enum validation at the edge prevents poison messages from reaching workers.
- Per-type payload schemas can be enforced in the processor, not just the route.

## Risks
- Payload schemas evolve. Version job payloads or use JSON Schema for forward compatibility.
