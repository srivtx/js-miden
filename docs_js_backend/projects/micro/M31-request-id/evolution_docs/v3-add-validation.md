# M31 Request ID — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Without validation, your API accepts anything as a request ID:

```bash
curl -H "X-Request-ID: <script>alert('xss')</script>" http://localhost:3000/health
curl -H "X-Request-ID: " http://localhost:3000/health
curl -H "X-Request-ID: way-too-long-string-..." http://localhost:3000/health
```

Your middleware echoes these back in the response header. The empty string breaks downstream correlation. The XSS string might be logged verbatim into a system that renders HTML. The 10KB ID bloats headers and logs.

## The Fix: Validate Request IDs

```ts
// validator.ts
export function validateRequestId(id: string): { valid: boolean; error?: string } {
  if (!id || id.length === 0) {
    return { valid: false, error: 'Request ID cannot be empty' };
  }
  if (id.length > 64) {
    return { valid: false, error: 'Request ID too long (max 64 chars)' };
  }
  if (!/^[a-zA-Z0-9\-_.]+$/.test(id)) {
    return { valid: false, error: 'Request ID contains invalid characters' };
  }
  return { valid: true };
}
```

```ts
// requestId.ts
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const incomingId = req.get('X-Request-ID');
  let requestId: string;

  if (incomingId) {
    const validation = validateRequestId(incomingId);
    if (!validation.valid) {
      // Log the bad ID but generate a new one
      console.warn(`Invalid X-Request-ID received: ${validation.error}`);
      requestId = generateRequestId();
    } else {
      requestId = incomingId;
    }
  } else {
    requestId = generateRequestId();
  }

  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
```

**What this prevents:**
- Empty request IDs breaking correlation
- XSS payloads in headers
- Header bloat from oversized IDs

## The Pain That Remains

You deploy to production. A user reports intermittent 500 errors. You check the logs — there are thousands of lines. You grep for the user's IP but find 50 requests in the same minute. Without structured logging tied to request IDs, you're still guessing.

## What v4 Fixes

Logging. Production without logs is flying blind.
