# M16 Redirector — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You extend the redirector to support custom status codes:

```js
app.post('/redirect', (req, res) => {
  const { url, status } = req.body;
  res.redirect(status, url); // WRONG — Express signature is res.redirect([status,] path)
});
```

**The bug:** You passed `(url, status)` but Express expects `(status, url)`. Without types, you only discover this when production redirects start returning 500s instead of 302s.

Another bug: `req.body` is `any`. You destructure `url` but TypeScript doesn't know if it exists. You might destructure `req.body.urll` (typo) and never know until runtime.

## The Fix: Add TypeScript

```ts
// app.ts
import express, { Request, Response } from 'express';
import { isValidRedirectUrl } from './validator.js';

export const app = express();
app.use(express.json());

app.post('/redirect', (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing url in request body' });
    return;
  }

  if (!isValidRedirectUrl(url)) {
    res.status(400).json({ error: 'Invalid or unsafe URL' });
    return;
  }

  res.redirect(302, url);
});
```

```ts
// validator.ts
export function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    if (!parsed.hostname) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
```

**What TS catches:**
- `req.body` is `any` by default, but your explicit checks make the intent clear
- `res.redirect(302, url)` — the number literal ensures you don't swap arguments
- `isValidRedirectUrl(url: string)` — the function signature documents its contract

## The Pain That Remains

TypeScript validates types, not security. `javascript:alert(1)` is a `string`. `data:text/html,<script>alert(1)</script>` is a `string`. Our validator needs to actively reject these.

## What v3 Fixes

Validation. Stop malicious URLs at the gate.
