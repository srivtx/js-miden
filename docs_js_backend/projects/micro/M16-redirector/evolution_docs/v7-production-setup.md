# M16 Redirector — v7 Production Setup

## Connect to src/

This is the final state. All evolutions converge into a clean, production-ready structure.

### Directory Structure

```
M16-redirector/
├── src/
│   ├── app.ts          # Express routes
│   └── validator.ts    # URL validation logic
├── tests/
│   └── app.test.ts     # Vitest + supertest
├── evolution_docs/     # This documentation
├── package.json
├── tsconfig.json
└── dist/               # Compiled JS (gitignored)
```

### Key Production Decisions

**1. Protocol Whitelist**

```ts
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
```

Only HTTP and HTTPS are allowed. This blocks:
- `javascript:` — XSS
- `data:` — data injection
- `file:` — local file access
- `ftp:` — unexpected protocols

**2. Hostname Validation**

```ts
if (!parsed.hostname) {
  return false;
}
```

URLs like `http://` or `https://` (empty host) are rejected. `new URL()` parses them without throwing, so this explicit check is critical.

**3. Status Code Awareness**

The current implementation uses 302 (temporary redirect). This is intentional — the redirector is a service, not a permanent resource mover. If you need 301/307/308, you extend the API contract, not change the default.

**4. Request Inspection Endpoint**

```ts
app.get('/info', (req: Request, res: Response) => {
  res.json({
    headers: req.headers,
    ip: req.ip,
    method: req.method,
    url: req.originalUrl,
  });
});
```

Useful for debugging proxies, headers, and request path behavior. In production, consider gating this behind auth.

**5. Self-execution Guard**

```ts
if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  app.listen(PORT);
}
```

Allows supertest to import `app` without starting the HTTP server.

### Evolution Summary

| Version | Pain | Fix |
|---------|------|-----|
| v1 | Open redirect, XSS, no validation | Wrote naive JS |
| v2 | Swapped redirect arguments | Added TypeScript |
| v3 | Malicious URLs accepted | Added strict URL validation |
| v4 | No audit trail | Added structured logging |
| v5 | Regressions on refactor | Added vitest + supertest |
| v6 | Legacy module system | Switched to ESM |
| v7 | Disorganized project | Clean `src/` structure |

### Running the Final Version

```bash
npm install
npm run dev      # tsx src/app.ts
npm run build    # tsc
npm start        # node dist/app.js
npm test         # vitest run
```
