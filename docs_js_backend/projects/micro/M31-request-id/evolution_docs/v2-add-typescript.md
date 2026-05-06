# M31 Request ID — v2 Add TypeScript

## The Bug: Types Catch YOUR Bugs

You add a simple timestamp-based ID:

```js
app.use((req, res, next) => {
  req.requestId = Date.now(); // number
  next();
});

app.get('/health', (req, res) => {
  console.log('health check', req.reqestId); // typo: reqestId
  res.json({ status: 'ok' });
});
```

**The bug:** `reqestId` is a typo. JavaScript silently returns `undefined`. Every log line shows `health check undefined`. You have no idea the typo exists.

Another bug: you treat the request ID as a string:

```js
app.get('/proxy', async (req, res) => {
  const headers = { 'X-Request-ID': req.requestId };
  await fetch('http://downstream/api', { headers });
});
```

`Date.now()` returns a number. The header value becomes `"1699999999999"` — a string, yes, but if downstream expects a UUID format, validation fails. TypeScript would flag the type mismatch.

## The Fix: Add TypeScript

```ts
// requestId.ts
import { Request, Response, NextFunction } from 'express';

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.get('X-Request-ID') || generateRequestId();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

export function getRequestId(req: Request): string {
  return (req as any).requestId || 'unknown';
}
```

```ts
// index.ts
import { requestIdMiddleware } from './requestId.js';

app.use(requestIdMiddleware);

app.get('/health', (req: Request, res: Response) => {
  // TypeScript ensures `getRequestId(req)` is always a string
  logger.info(req, 'health check');
  res.json({ status: 'ok' });
});
```

Now `tsc` errors on:
```
index.ts:5:28 - error TS2339: Property 'reqestId' does not exist on type 'Request'.
```

## But TypeScript Doesn't Catch Everything

TypeScript validates **compile-time** shapes, not **runtime** behavior. A client can send:
```
X-Request-ID: <script>alert('xss')</script>
```
TypeScript sees a string, but at runtime it's an XSS payload. You blindly echo it back. We need validation.

> **Lesson:** TypeScript eliminates typos and wrong shapes. But runtime validation is required because the network doesn't respect your type declarations.

## What v3 Fixes

Validation. Reject malformed request IDs before they propagate.
