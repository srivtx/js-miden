# v3-add-validation

## Goal
Reject bad URLs and invalid custom codes before DB writes.

## Changes
1. URL format validation with `new URL()`.
2. Protocol whitelist (`http:`, `https:`).
3. Custom code regex (`[a-zA-Z0-9_-]{3,32}`).
4. `expiresInDays` must be a positive integer ≤ 365.

## Code

```ts
// src/validation.ts
import { z } from 'zod';

export const shortenSchema = z.object({
  url: z.string().url().refine((u) => {
    try {
      const parsed = new URL(u);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, { message: 'Only HTTP/HTTPS URLs allowed' }),
  customCode: z.string().regex(/^[a-zA-Z0-9_-]{3,32}$/).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
```

```ts
// src/controller.ts
import { shortenSchema } from './validation.js';

export async function createShortUrl(req: Request, res: Response) {
  const parsed = shortenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const shortCode = await createShortCode(parsed.data.url, parsed.data.customCode, parsed.data.expiresInDays);
  return res.status(201).json({ shortCode, url: parsed.data.url });
}
```

## Decisions
- `zod` URL + protocol check blocks `javascript:`, `file:`, and `data:` schemes.
- Custom code regex prevents path traversal and spaces.

## Risks
- URL could still redirect to a phishing site. Add domain blacklist or safe-browsing API for true safety.
