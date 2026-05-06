# M11: CORS Tester

An Express API that demonstrates CORS behavior with public and private endpoints.

## Endpoints

- `GET /public` - Open data, no credentials required
- `GET /private` - Authenticated data, strict origin check (intended)

## Quick Start

```bash
npm install
npm run dev      # development server on :3000
npm test         # run tests
```

## Phase 1: Basic Implementation

The API mounts two route groups with different CORS policies:

- `/public` uses `cors()` — open to any origin, no credentials.
- `/private` uses `cors({ origin: '*', credentials: true })` — intended to allow authenticated requests.

Preflight `OPTIONS` requests are handled automatically by the `cors` middleware.

## Phase 2-3: Design Thinking

### 1. Origin Validation Strategy

**Decision needed:** How should we validate the `Origin` header for credentialed requests?

- **Wildcard `*` (current, BUGGY):** Sends `Access-Control-Allow-Origin: *` to every request.
  - Pros: Simple, no configuration.
  - Cons: **Security vulnerability.** Browsers reject `*` when `credentials: true` is present. Even if browsers allowed it, any malicious site could read authenticated responses.
- **Reflect origin (cors({ origin: true })):** Mirrors the request's `Origin` header back.
  - Pros: Works with credentials.
  - Cons: Allows **any** origin to make credentialed requests — only slightly better than `*`.
- **Allowlist (correct):** Maintain a list of approved origins. Only reflect the origin if it matches.
  - Pros: Strict security boundary.
  - Cons: Requires configuration and maintenance.

**Conclusion:** Use an explicit allowlist for credentialed endpoints. Reflect the origin only if it is in the list.

### 2. Credentials + Wildcard Interaction

**Decision needed:** What happens when `origin: '*'` and `credentials: true` are combined?

- The `cors` package will send both headers: `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Credentials: true`.
- Modern browsers will **block** the response because the spec forbids `*` with credentials.
- However, the server is still **advertising** to any origin that it is willing to share authenticated data. This is an information leak and a misconfiguration.

**Conclusion:** Never combine `origin: '*'` with `credentials: true`. Use an allowlist instead.

### 3. Preflight Cache (`Access-Control-Max-Age`)

**Decision needed:** How long should browsers cache preflight responses?

- **No cache:** Every non-simple request triggers an extra `OPTIONS` round-trip.
- **Long cache (e.g., 86400s):** Reduces round-trips but delays policy updates.
- **Short cache (e.g., 600s):** Balance between performance and agility.

**Conclusion:** Set `maxAge` to a reasonable value (e.g., 600 seconds) for stable APIs. For APIs with frequent CORS policy changes, keep it short.

### 4. Vary: Origin Header

When using dynamic origin reflection, the response varies by `Origin`. Without `Vary: Origin`, a CDN or cache might serve a response with the wrong CORS headers to a different origin.

**Conclusion:** Always include `Vary: Origin` when reflecting origins.

## Known Bug

The current implementation has a **CORS security vulnerability**:

`/private` uses `cors({ origin: '*', credentials: true })`. This tells the browser (and any attacker) that authenticated responses are available to **any origin**. Browsers will reject the response at the client level, but the server is misconfigured.

### How to fix

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

Also add `Vary: Origin` and set a sensible `maxAge` for preflight caching.
