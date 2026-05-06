# Concepts Explained

## Concept: CORS Preflight Requests

### What Is It?
A preflight request is an `OPTIONS` request that the browser sends automatically before a non-simple cross-origin request. It asks the server: "Are you willing to accept a real request with these properties?"

### Why Do We Use It?
The preflight protects legacy servers that were built before CORS existed. An old server might accept a `DELETE` request and destroy data without knowing the request came from a browser on another origin. The preflight gives modern servers a chance to say "I understand CORS and I consent to this cross-origin interaction."

### How Does It Work?

```
Browser wants to POST /private with Authorization header:

1. Browser sends OPTIONS first:
   OPTIONS /private HTTP/1.1
   Origin: https://app.example.com
   Access-Control-Request-Method: GET
   Access-Control-Request-Headers: Authorization

2. Server responds with allowed parameters:
   HTTP/1.1 204 No Content
   Access-Control-Allow-Origin: https://app.example.com
   Access-Control-Allow-Methods: GET,POST
   Access-Control-Allow-Headers: Authorization
   Access-Control-Allow-Credentials: true
   Access-Control-Max-Age: 600

3. Browser caches this permission for 600 seconds.

4. Browser sends the real GET /private request.
```

### Code Example
```typescript
// The cors middleware handles this automatically.
// We just configure it.
app.use('/private', cors({
  origin: (origin, callback) => {
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  maxAge: 600,
}), privateRouter);
```

### Common Misconceptions
- **Wrong way:** "The preflight is a waste. I should disable it."
  - **Right way:** You cannot disable preflight. It is browser-enforced for non-simple requests. The only way to avoid it is to make your requests simple (no custom headers, no JSON body, no credentials).
- **Wrong way:** "I handle OPTIONS manually in my routes."
  - **Right way:** Let the `cors` middleware handle OPTIONS. Manual handling is error-prone and often misses required headers.

### Related Concepts
- Same-Origin Policy (SOP)
- Simple vs Preflighted requests
- `Access-Control-Allow-Credentials`

---

## Concept: Origin Validation

### What Is It?
Origin validation is the process of checking whether the `Origin` header sent by the browser matches a list of trusted origins. Only matching origins receive `Access-Control-Allow-Origin` in the response.

### Why Do We Use It?
Without origin validation, any website can embed JavaScript that calls your API and reads the responses. With validation, the browser blocks responses from reaching untrusted origins, even if the request physically reaches your server.

### How Does It Work?

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│ evil.com        │         │ Browser         │         │ api.example.com │
│                 │         │                 │         │                 │
│ fetch(api)      │────────▶│ attaches        │────────▶│ checks origin   │
│                 │         │ Origin: evil.com│         │ against list    │
└─────────────────┘         └─────────────────┘         └────────┬────────┘
                                                                 │
                                                          ┌──────┴──────┐
                                                          │ NOT in list │
                                                          │ deny CORS   │
                                                          └──────┬──────┘
                                                                 │
                                                          ┌──────┴──────┐
                                                          │ Response    │
                                                          │ without ACAO│
                                                          └──────┬──────┘
                                                                 │
                                                          ┌──────┴──────┐
                                                          │ Browser     │
                                                          │ blocks JS   │
                                                          │ from reading│
                                                          └─────────────┘
```

### Code Example
```typescript
const ALLOWED_ORIGINS = [
  'https://app.example.com',
  'https://admin.example.com',
];

app.use('/private', cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

### Common Misconceptions
- **Wrong way:** `"Access-Control-Allow-Origin: *" allows everyone, which is what I want for a public API.`
  - **Right way:** `*` is fine for public APIs that do NOT use cookies or auth headers. The moment you need credentials, `*` becomes a lie — browsers reject it, and your API looks broken.
- **Wrong way:** `"I check origin on the server, so I'm safe even without CORS."`
  - **Right way:** CORS is enforced by the BROWSER, not your server. Your server sees every request. CORS headers only control whether the browser JavaScript on the other origin is allowed to READ the response.

### Related Concepts
- Allowlist / Denylist patterns
- `Origin` header vs `Referer` header

---

## Concept: Credentials in CORS

### What Is It?
Credentials include cookies, HTTP authentication headers (like `Authorization`), and TLS client certificates. When a cross-origin request includes credentials, the browser applies stricter CORS rules.

### Why Do We Use It?
Authenticated APIs need credentials. A todo app without cookies cannot know who is logged in. But credentials also mean the request carries the user's identity, so the browser must be extra careful about which origins can read responses.

### How Does It Work?

When `credentials: true` is set:
1. The server MUST NOT send `Access-Control-Allow-Origin: *`. It must echo the exact origin.
2. The server MUST include `Access-Control-Allow-Credentials: true`.
3. The browser will reject the response if either rule is violated.

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER RULES for credentialed requests                     │
│                                                              │
│  IF response has ACA-Credentials: true                      │
│    AND response has ACA-Origin: *                           │
│      THEN → BLOCK response (spec violation)                 │
│    AND response has ACA-Origin: [exact origin match]        │
│      THEN → ALLOW response                                  │
└─────────────────────────────────────────────────────────────┘
```

### Code Example
```typescript
// WRONG: Browser will block this!
app.use('/private', cors({ origin: '*', credentials: true }));

// RIGHT: Exact origin reflection with credentials
app.use('/private', cors({ origin: 'https://app.example.com', credentials: true }));

// BETTER: Dynamic reflection from allowlist
app.use('/private', cors({
  origin: (origin, callback) => {
    if (ALLOWED_ORIGINS.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed'));
  },
  credentials: true,
}));
```

### Common Misconceptions
- **Wrong way:** `"Setting credentials: true and origin: * is a valid fallback."`
  - **Right way:** It is explicitly forbidden by the Fetch spec. Browsers MUST reject it. You will see CORS errors in the console, and your frontend will be broken.
- **Wrong way:** `"If I don't set credentials, I don't need CORS at all."`
  - **Right way:** Without credentials, CORS is still required for cross-origin reads. The browser still blocks responses unless the server sends `Access-Control-Allow-Origin`.

### Related Concepts
- `withCredentials` in XMLHttpRequest / fetch
- Cookie `SameSite` attribute
- `Authorization` header

---

## Concept: The `Vary: Origin` Header

### What Is It?
`Vary: Origin` tells HTTP caches (including CDNs and browser caches) that the response content depends on the `Origin` request header. A cached response for `Origin: https://a.com` must NOT be served to a request with `Origin: https://b.com`.

### Why Do We Use It?
Without `Vary: Origin`, a shared cache might store a response that says `Access-Control-Allow-Origin: https://a.com` and then serve it to `https://b.com`. The browser sees the wrong origin and blocks the response. Worse, if the cache ignores CORS headers entirely, it could leak cached authenticated data across origins.

### How Does It Work?

```
Request 1: Origin: https://a.com
           Response: ACA-Origin: https://a.com
           Cache stores this response

Request 2: Origin: https://b.com
           Without Vary: Origin → cache serves the stored response
           Browser sees ACA-Origin: https://a.com ≠ https://b.com
           → BLOCKS response (or worse, allows if relaxed)

With Vary: Origin → cache knows the response is keyed by Origin
           → cache MISS for https://b.com
           → server generates fresh response with correct origin
```

### Code Example
```typescript
// The cors package adds Vary: Origin automatically when origin is dynamic.
// But if you write custom CORS middleware, you MUST add it:
res.setHeader('Vary', 'Origin');
res.setHeader('Access-Control-Allow-Origin', origin);
```

### Common Misconceptions
- **Wrong way:** `"Vary: Origin is only needed for CDNs, not for my app."`
  - **Right way:** Browser caches also respect `Vary`. Even without a CDN, two users on different origins hitting the same URL from the same browser profile could get cross-contaminated cached responses.
- **Wrong way:** `"I can skip Vary if I use origin: *."`
  - **Right way:** `*` is static, so `Vary: Origin` is technically unnecessary with `*`. But `*` should never be used with credentials, so this is a moot point for authenticated APIs.

### Related Concepts
- HTTP caching (RFC 7234)
- CDN cache poisoning
- `Cache-Control` headers

---

## Concept: Wildcard Dangers

### What Is It?
Using `*` as the `Access-Control-Allow-Origin` value tells every origin it may read responses. It is the CORS equivalent of leaving your front door unlocked.

### Why Do We Use It?
We DON'T use it for authenticated endpoints. We ONLY use it for truly public, unauthenticated endpoints where the response contains no sensitive data.

### How Does It Work?

```
        ┌──────────────────────────────────────────┐
        │  Wildcard Behavior Matrix               │
        ├──────────────────────────────────────────┤
        │  Credentials? │  Wildcard allowed?      │
        │  ─────────────┼────────────────────────  │
        │  No           │  Yes                    │
        │  Yes          │  NO (browser blocks)    │
        └──────────────────────────────────────────┘
```

When `credentials: true` is present, browsers apply the `*` prohibition. But the server still sends the header, which means:
1. The server is advertising its misconfiguration to the world.
2. Non-browser clients (curl, Python requests, server-to-server) do not enforce CORS. They will see `*` and proceed, which is fine — but it proves the server has no origin control.
3. If a future API version removes credentials but keeps `*`, the hole becomes exploitable immediately.

### Code Example
```typescript
// DANGEROUS for authenticated endpoints
app.use('/private', cors({ origin: '*', credentials: true }));

// SAFE for public endpoints only
app.use('/public', cors()); // origin defaults to *, credentials false

// SAFE for authenticated endpoints
app.use('/private', cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));
```

### Common Misconceptions
- **Wrong way:** `"Browsers block * with credentials, so there's no real risk."`
  - **Right way:** Browsers block it, but the server is still configured wrong. It tells attackers "I tried to allow everyone." It also breaks your frontend. And non-browser clients don't enforce CORS at all — if your API is meant to be browser-only, `*` is doubly wrong.
- **Wrong way:** `"I'll use * during development and fix it in production."`
  - **Right way:** "Temporary" configs have a way of becoming permanent. Use the same allowlist in dev (pointing at `http://localhost:3000`) and prod.

### Related Concepts
- Principle of least privilege
- Security through obscurity vs explicit boundaries
