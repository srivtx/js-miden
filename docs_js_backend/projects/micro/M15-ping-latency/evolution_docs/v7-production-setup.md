# M15 Ping API — v7 Production Setup

## Connect to src/

This is the final state. All previous evolutions converge into a clean, production-ready structure.

### Directory Structure

```
M15-ping-latency/
├── src/
│   ├── app.ts          # Express routes
│   └── latency.ts      # DNS + TCP latency measurement
├── tests/
│   └── app.test.ts     # Vitest + supertest
├── evolution_docs/     # This documentation
├── package.json
├── tsconfig.json
└── dist/               # Compiled JS (gitignored)
```

### Key Production Decisions

**1. DNS Resolution BEFORE TCP Connection**

```ts
const addresses = await lookup(host);
const ip = addresses.address;
if (isBlockedIP(ip)) {
  throw new Error('Access to internal IPs is blocked');
}
```

We resolve DNS first so we can block rebinding attacks. If we only checked the hostname, `evil.com → 127.0.0.1` would bypass our filter.

**2. SSRF Defense in Depth**

- Pre-DNS host block: `localhost`, `127.0.0.1`, `0.0.0.0`
- Post-DNS IP block: private ranges (`10.x`, `192.168.x`, `172.16-31.x`, link-local)
- TCP timeout: 5 seconds max — prevents event loop starvation

**3. Environment-based Configuration**

```ts
const PORT = process.env.PORT ?? 3000;
```

Local dev uses 3000. Production uses whatever the platform assigns.

**4. Proper Error Boundaries**

```ts
try {
  const result = await measureLatency(target);
  res.json(result);
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  res.status(403).json({ error: message });
}
```

Never leak stack traces to clients. Always normalize unknown errors.

**5. Self-execution Guard**

```ts
if (import.meta.url.endsWith(process.argv[1] ?? '')) {
  app.listen(PORT);
}
```

Allows `supertest` to import `app` without starting the server.

### Evolution Summary

| Version | Pain | Fix |
|---------|------|-----|
| v1 | No SSRF protection, no timeout | Wrote naive JS |
| v2 | Type errors at runtime | Added TypeScript |
| v3 | Attacker probes internal network | Added validation (pre + post DNS) |
| v4 | Silent hangs in production | Added structured logging |
| v5 | Regressions on every refactor | Added vitest + supertest |
| v6 | Stuck on legacy module system | Switched to ESM |
| v7 | Disorganized project | Clean `src/` structure, env config |

### Running the Final Version

```bash
npm install
npm run dev      # tsx src/app.ts
npm run build    # tsc
npm start        # node dist/app.js
npm test         # vitest run
```
