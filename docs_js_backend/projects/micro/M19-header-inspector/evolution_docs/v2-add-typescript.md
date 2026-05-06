# M19 Header Inspector — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You extend the inspector to analyze security headers:

```js
app.get('/security', (req, res) => {
  const headers = req.headers;
  const present = [];
  for (const h of SECURITY_HEADERS) {
    if (headers[h]) present.push(h);
  }
  // Bug: headers[h] might be string[]. push() doesn't care, but JSON serialization
  // of string[] inside present[] is confusing.
});
```

**The bug:** `req.headers['x-forwarded-for']` is `string | string[] | undefined`. TypeScript doesn't know this in JS. You might do `headers[h].toLowerCase()` and crash when it's an array.

Another bug:
```js
const ip = req.socket.remoteAddress; // might be undefined
ip.split(':'); // TypeError: Cannot read property 'split' of undefined
```

## The Fix: Add TypeScript

```ts
// inspector.ts
import { Request, Response, NextFunction } from 'express';

export function setSecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

export function extractClientIp(req: Request) {
  const remoteAddress = req.socket.remoteAddress || 'unknown';
  // TypeScript knows remoteAddress is string | undefined
  // ...
}

export function analyzeSecurityHeaders(req: Request) {
  const headers = req.headers;
  const present: string[] = [];
  const missing: string[] = [];
  for (const h of SECURITY_HEADERS) {
    if (headers[h]) {
      present.push(h);
    } else {
      missing.push(h);
    }
  }
  return { present, missing, score: `${present.length}/${SECURITY_HEADERS.length}` };
}
```

```ts
// index.ts
import express, { Request, Response } from 'express';
import { extractClientIp, analyzeSecurityHeaders, setSecurityHeaders } from './inspector.js';

const app = express();
app.use(express.json());
app.use(setSecurityHeaders); // Types ensure this is a valid Express middleware
```

**What TS catches:**
- `req.socket.remoteAddress` is `string | undefined` — forces null-check
- `req.headers[h]` is `string | string[] | undefined` — no unsafe string methods
- Middleware signature must be `(req, res, next) => void` — catches wrong arity

## The Pain That Remains

TypeScript knows `xff` is a `string | string[]`, but it doesn't know that the first IP in `X-Forwarded-For` might be forged. We need runtime validation of the proxy chain.

## What v3 Fixes

Validation. Trust no header without verifying the proxy.
