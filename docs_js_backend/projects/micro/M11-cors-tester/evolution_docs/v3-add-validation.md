# v3-add-validation.md — CORS Tester

## The Pain

TypeScript (v2) validated the `cors` option shapes, but the **values** were still dangerously wrong:

```typescript
const privateCors: CorsOptions = {
  origin: '*',        // BUG: wildcard with credentials
  credentials: true,
};
```

1. `origin: '*'` with `credentials: true` tells **any website** it can make authenticated requests to our API.
2. Modern browsers reject this combination, but the server is still **advertising** the misconfiguration.
3. No validation of the `Origin` header against an allowlist.

## The Fix: Add Runtime Origin Validation

```typescript
// cors.ts
const ALLOWED_ORIGINS = ['https://app.example.com', 'https://admin.example.com'];

export const publicCors = cors();

export const privateCors = cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  maxAge: 600,  // cache preflight for 10 minutes
});
```

Now:
- `Origin: https://evil.com` → rejected with 403
- `Origin: https://app.example.com` → allowed, with `Access-Control-Allow-Origin: https://app.example.com`
- Preflight responses are cached for 600 seconds

## But Validation Doesn't Fix CDN Caching

If a CDN caches a CORS response without `Vary: Origin`, it might serve the wrong CORS headers to a different origin. Runtime validation helps, but HTTP cache semantics require additional headers.

> **Lesson:** Runtime validation enforces security policies at the request level. But HTTP caching and CDN behavior require additional header discipline.
