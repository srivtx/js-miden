# M19 Header Inspector — v7 Production Setup

## Connect to src/

This is the final state. All evolutions converge into a clean, production-ready structure.

### Directory Structure

```
M19-header-inspector/
├── src/
│   ├── index.ts            # Express routes
│   ├── inspector.ts        # Safe header inspection
│   └── inspector.buggy.ts  # Intentionally buggy (for comparison)
├── tests/
│   └── app.test.ts         # Vitest + supertest
├── evolution_docs/         # This documentation
├── package.json
├── tsconfig.json
└── dist/                   # Compiled JS (gitignored)
```

### Key Production Decisions

**1. Proxy-Aware IP Extraction**

```ts
export function extractClientIp(req: Request) {
  const remoteAddress = req.socket.remoteAddress || 'unknown';

  if (!isTrustedProxy(remoteAddress)) {
    return { ip: remoteAddress, source: 'direct', trusted: true };
  }

  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    const ips = xff.split(',').map(ip => ip.trim()).filter(isValidIP);
    if (ips.length > 0) {
      return { ip: ips[0], source: 'x-forwarded-for', trusted: true };
    }
  }

  const xri = req.headers['x-real-ip'];
  if (typeof xri === 'string' && isValidIP(xri)) {
    return { ip: xri, source: 'x-real-ip', trusted: true };
  }

  return { ip: remoteAddress, source: 'direct', trusted: true };
}
```

Critical rule: **Only trust `X-Forwarded-For` if the direct connection is a trusted proxy.** If `remoteAddress` is an untrusted client, ignore the header entirely.

**2. Security Headers Middleware**

```ts
export function setSecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}
```

Applied globally via `app.use(setSecurityHeaders)`.

**3. IP Validation**

```ts
function isValidIP(ip: string): boolean {
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4.test(ip) || ipv6.test(ip) || ip === '::1';
}
```

Rejects `not-an-ip`, empty strings, and malformed values before they propagate.

**4. Header Sanitization**

```ts
app.get('/headers', (req: Request, res: Response) => {
  const headers: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key] = value;
  }
  res.json({ headers });
});
```

Explicit conversion to plain object — no prototype pollution, no accidental method exposure.

### Evolution Summary

| Version | Pain | Fix |
|---------|------|-----|
| v1 | IP spoofing, no security headers, blind XFF trust | Wrote naive JS |
| v2 | Header type crashes | Added TypeScript |
| v3 | Attacker bypasses proxy checks | Added proxy-aware validation |
| v4 | No audit trail | Added structured logging |
| v5 | Regressions on refactor | Added vitest + supertest |
| v6 | Legacy module system | Switched to ESM |
| v7 | Disorganized project | Clean `src/` structure |

### Running the Final Version

```bash
npm install
npm run dev      # tsx watch src/index.ts
npm run build    # tsc
npm start        # node dist/index.js
npm test         # vitest run
```
