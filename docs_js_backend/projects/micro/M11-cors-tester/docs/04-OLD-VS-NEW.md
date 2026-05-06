# Old Ways vs New Ways (2025)

## Pattern: CORS Configuration

### The Old Way (2015-2020)
```javascript
// app.js
const express = require('express');
const app = express();

// The "fix everything" approach
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
```
**Why we did it:** Stack Overflow answers from 2015 universally recommended this. It made CORS errors disappear. Most developers did not understand that `*` and credentials are incompatible.

**Why it is wrong now:**
1. `*` with credentials is a spec violation — browsers block it.
2. No origin validation means any site can phish your users and read responses.
3. Manual header setting forgets `Vary: Origin`, causing cache poisoning.
4. No preflight `OPTIONS` handling — some requests fail mysteriously.

### The New Way (2025)
```typescript
// app.ts
import express from 'express';
import cors from 'cors';

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL!,
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
  maxAge: 600,
}));
```
**Why it is better:**
1. Explicit allowlist = real security boundary.
2. `credentials: true` + dynamic origin = browser-compliant.
3. `maxAge` reduces preflight overhead.
4. `cors` package adds `Vary: Origin` automatically.

**When to still use old way:** Never for authenticated APIs. Only for truly public, read-only endpoints where the response contains zero sensitive data (e.g., a public weather API).

### Migration Path
1. Replace manual header setting with the `cors` package.
2. Audit every endpoint that uses credentials.
3. Replace `origin: '*'` with an allowlist.
4. Add `Vary: Origin` if using custom middleware.
5. Set `maxAge` to a reasonable value.

---

## Pattern: Preflight Handling

### The Old Way (2015-2020)
```javascript
// Manual OPTIONS handler in every route file
app.options('/api/*', (req, res) => {
  res.sendStatus(200);
});
```
**Why we did it:** Before the `cors` package was universally adopted, developers manually handled OPTIONS. Many sent `200 OK` without any CORS headers, which does nothing — the browser needs the `Access-Control-Allow-*` headers to proceed.

**Why it is wrong now:** An empty `200 OK` on OPTIONS tells the browser "this server exists" but not "this server allows CORS." The browser still blocks the real request. It is a no-op that looks like it works.

### The New Way (2025)
```typescript
// cors middleware handles OPTIONS automatically
app.use('/private', cors({ origin: ALLOWED_ORIGINS, credentials: true }));
```
**Why it is better:** The `cors` package inspects the `Access-Control-Request-Method` and `Access-Control-Request-Headers` headers, compares them against the configured allowlist, and sends the correct `Access-Control-Allow-*` response. It also sends `204 No Content`, which is the correct status for a successful preflight.

**When to still use old way:** If you are building a framework from scratch (e.g., a custom HTTP server in Rust or Go), you must implement preflight yourself. But in Express/Node.js, use the package.

---

## Pattern: Environment-Based CORS

### The Old Way (2015-2020)
```javascript
if (process.env.NODE_ENV === 'development') {
  app.use(cors({ origin: '*' }));
} else {
  app.use(cors({ origin: 'https://prod.example.com' }));
}
```
**Why we did it:** Developers wanted permissive CORS in local development.

**Why it is wrong now:** Using `*` in dev trains your muscle memory to accept it. When you copy-paste config to production, you might accidentally bring `*` with it. Also, `*` breaks frontend frameworks that need `credentials: true` even in development (e.g., cookie-based auth on `localhost`).

### The New Way (2025)
```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173', // Vite default
  process.env.FRONTEND_URL!,
];

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
```
**Why it is better:** The same allowlist works in dev and prod. No special-casing. No risk of `*` leaking to production. Frontend auth works identically in both environments.
