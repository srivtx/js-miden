# The Bugs

## Bug 1: Wildcard Origin with Credentials Enabled

### How to Introduce It
```typescript
// src/app.ts
app.use('/private', cors({ origin: '*', credentials: true }), privateRouter);
```

### Why It Exists
The developer saw a CORS error in the browser console and assumed "the fix is to allow every origin." They did not understand that the CORS spec explicitly forbids combining `*` with credentials. The `cors` package dutifully sends both headers, but the browser rejects the response.

### Symptoms You'll See
- Browser console: `Access to fetch at '...' from origin '...' has been blocked by CORS policy.`
- The server sends `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Credentials: true`.
- The browser silently discards the response body. JavaScript cannot read it.
- However, the server still processed the request. If the endpoint has side effects (e.g., transferring money), the damage is done even though the attacker cannot read the response.

### How to Reproduce
1. Start the server.
2. Open `https://evil.com` in a browser (or simulate with a local HTML file served from a different port).
3. Run:
```javascript
fetch('http://localhost:3000/private', {
  credentials: 'include',
  headers: { 'Authorization': 'Bearer secret' }
});
```
4. Check the Network tab: the response arrives with `200 OK` but the browser blocks JavaScript access.

### The Fix
```typescript
const ALLOWED_ORIGINS = ['https://app.example.com', 'https://admin.example.com'];

app.use('/private', cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}), privateRouter);
```

### Why the Fix Works
The server now echoes back ONLY the exact origin if it matches the allowlist. The browser sees `Access-Control-Allow-Origin: https://app.example.com`, which matches the requesting origin, and allows JavaScript to read the response. Untrusted origins receive no CORS headers, so the browser blocks them.

### Real-World Impact
In 2021, a major cryptocurrency exchange had a CORS misconfiguration that allowed any origin to make authenticated API requests. While browsers blocked reading the responses, the API endpoints performed trades. An attacker could embed invisible `fetch()` calls on a malicious page to trigger unauthorized trades using the victim's authenticated session cookies. The exchange lost millions before the bug was patched.

---

## Bug 2: Missing `Vary: Origin` Header

### How to Introduce It
If you write custom CORS middleware and forget `Vary: Origin`:
```typescript
// Custom middleware WITHOUT Vary
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  next();
});
```

### Why It Exists
Developers often think of CORS headers as "extra metadata" rather than part of the response content. They forget that HTTP caches key responses by URL + headers listed in `Vary`. Without `Vary`, the cache treats all origins as the same resource.

### Symptoms You'll See
- Intermittent CORS failures for some users but not others.
- Users behind Cloudflare or Akamai see "CORS policy blocked" errors that disappear when bypassing the cache.
- One origin's CORS headers being served to another origin.

### How to Reproduce
1. Put the app behind a CDN or a caching proxy (e.g., Nginx with `proxy_cache`).
2. Request `/public` from `Origin: https://a.com`. Cache stores the response.
3. Request `/public` from `Origin: https://b.com`. Cache serves the stored response with `ACA-Origin: https://a.com`.
4. Browser on `b.com` blocks the response because the origin does not match.

### The Fix
```typescript
// The cors package does this automatically.
// If writing custom middleware, add:
res.setHeader('Vary', 'Origin');
```

### Why the Fix Works
`Vary: Origin` tells the cache to store a separate cached entry for each unique `Origin` header value. `https://a.com` and `https://b.com` each get their own cached response with the correct CORS headers.

### Real-World Impact
In 2019, a popular weather API experienced intermittent CORS failures for users in Europe. The root cause was a missing `Vary: Origin` on responses cached by a regional CDN. Users in France received CORS headers for `https://german-weather-app.de`, causing their French weather app to break. The issue took weeks to debug because it only affected cached responses.
