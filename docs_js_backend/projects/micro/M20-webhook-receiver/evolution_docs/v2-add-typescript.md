# M20 Webhook Receiver — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You refactor to use raw body for signature verification:

```js
app.use(express.json());

app.post('/webhook/:provider', (req, res) => {
  const payload = req.body; // Bug: this is PARSED JSON, not raw bytes!
  verifySignature(provider, payload, req.headers);
});
```

**The bug:** HMAC signatures are computed on raw bytes. `express.json()` parses the body into an object. When you stringify it back for verification, key ordering and whitespace might differ. The signature never matches. TypeScript wouldn't catch this directly, but explicit `Buffer` types would have forced you to think about it.

Another bug:
```js
const verified = verifyWebhook(provider, payload, headers);
if (!verified.valid) {
  res.status(401).json({ error: verified.reason });
}
// Bug: forgot return! Execution continues to process the webhook even if invalid.
```

## The Fix: Add TypeScript

```ts
// index.ts
import express, { Request, Response } from 'express';
import { verifyWebhook, processEventAsync, getEvents, isValidProvider } from './webhook.js';

const app = express();

// Use RAW body for signature verification
app.use(express.raw({ type: 'application/json', limit: '1mb' }));

app.post('/webhook/:provider', async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider;
    if (!isValidProvider(provider)) {
      res.status(400).json({ error: 'Unknown provider' });
      return; // TypeScript void return enforces early exit
    }

    const payload = req.body as Buffer;
    const headers = req.headers;

    const verified = verifyWebhook(provider, payload, headers);
    if (!verified.valid) {
      res.status(401).json({ error: 'Invalid signature', reason: verified.reason });
      return;
    }

    // ...
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

```ts
// webhook.ts
export function verifyWebhook(
  provider: string,
  payload: Buffer,
  headers: IncomingHttpHeaders
): {
  valid: boolean;
  reason?: string;
  eventId?: string;
  tooOld?: boolean;
  duplicate?: boolean;
} {
  // ...
}
```

**What TS catches:**
- `req.body as Buffer` — documents that we need raw bytes, not parsed JSON
- `verifyWebhook` return type — forces consumers to check all fields
- `return` after `res.status(...)` — `noImplicitReturns` ensures all branches return

## The Pain That Remains

TypeScript knows `payload` is `Buffer`, but it doesn't verify HMAC signatures. An attacker can still send any payload. We need cryptographic validation.

## What v3 Fixes

Validation. Verify signatures, check timestamps, deduplicate events.
