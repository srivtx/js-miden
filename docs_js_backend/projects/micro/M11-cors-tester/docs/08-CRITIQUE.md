# Critic Review

## Technical Review

**What a senior engineer would say:**

"This project correctly identifies the most dangerous CORS anti-pattern: `*` with credentials. The separation of `/public` and `/private` routes is good. However, I have three concerns:

1. **The allowlist is hardcoded.** In production, `ALLOWED_ORIGINS` should come from environment variables. Hardcoding domains makes deployments inflexible and increases the risk of dev domains leaking into production.

2. **No `maxAge` is set.** The default preflight cache duration depends on the browser. Setting it explicitly to 600 seconds is better than leaving it to chance.

3. **Error handling in the `origin` callback is weak.** If `callback(new Error(...))` is called, the `cors` package sends a generic 500. You should catch CORS errors and return a 403 with a clear message: 'This origin is not authorized.'"

## Security Review

**Potential vulnerabilities:**

1. **Origin header spoofing by non-browser clients.** Curl, Python, and server-to-server requests can send any `Origin` header. CORS does NOT protect against these clients because they do not enforce CORS. Your API MUST have additional authentication (tokens, signatures) beyond CORS.

2. **Subdomain takeover.** If `https://app.example.com` is in your allowlist and an attacker takes over a subdomain (e.g., `https://old-app.example.com`), they gain CORS access. Use wildcard subdomains sparingly (`*.example.com`) and monitor DNS.

3. **Null origin.** Some browsers send `Origin: null` for `file://` URLs, sandboxed iframes, or redirects. If you allow `null` in your allowlist, attackers can exploit it. The correct approach is to reject `null` unless you explicitly need it.

## Educational Review

**What's missing or confusing:**

- The project does not demonstrate what happens when a preflight is cached and then the policy changes. A deeper exercise would revoke an origin and show the browser continuing to use the cached preflight.
- There is no discussion of `Access-Control-Expose-Headers`, which controls which response headers the browser JavaScript can read. This is important for APIs that return custom headers like `X-Request-Id`.
- The `cors` package internals are treated as a black box. Reading the source (it is only ~200 lines) would be an excellent learning exercise.

## Fixes Applied

Based on this critique, we would make these changes:

1. Move `ALLOWED_ORIGINS` to an environment variable with a sensible default.
2. Set `maxAge: 600` explicitly.
3. Add a custom error handler for CORS failures that returns 403 instead of 500.
4. Reject `Origin: null` explicitly.

```typescript
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

app.use('/private', cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Same-origin or non-browser
    if (origin === 'null') return callback(new Error('Null origin not allowed'));
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  credentials: true,
  maxAge: 600,
}));

// Custom CORS error handler
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err.message === 'Origin not allowed') {
    res.status(403).json({ error: 'CORS policy: this origin is not authorized' });
    return;
  }
  next(err);
});
```
