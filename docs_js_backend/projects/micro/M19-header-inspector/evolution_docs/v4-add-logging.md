# M19 Header Inspector — v4 Add Logging

## The Bug: Production Visibility Crisis

Your header inspector runs in production. You have no visibility into:
- How many requests come through proxies vs directly
- Whether spoofed `X-Forwarded-For` headers are being ignored
- Which security headers are missing on incoming requests
- Attackers probing with malformed headers

```ts
// Without logging — silent operation
app.get('/ip', (req, res) => {
  const result = extractClientIp(req);
  res.json(result); // No audit trail
});
```

A security incident: *"Someone accessed admin from IP 1.2.3.4."* You check your logs... your logs show `1.2.3.4` because an attacker set `X-Forwarded-For: 1.2.3.4` and your old code trusted it. But did your new validation code catch it? You have no logs to prove it.

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  logger.info({ requestId: req.id, method: req.method, path: req.path }, 'Request started');
  next();
});

app.get('/ip', (req: Request, res: Response) => {
  const result = extractClientIp(req);
  logger.info({
    requestId: req.id,
    ip: result.ip,
    source: result.source,
    trusted: result.trusted,
    remoteAddress: req.socket.remoteAddress,
    xff: req.headers['x-forwarded-for'],
  }, 'IP extracted');
  res.json(result);
});

app.get('/security', (req: Request, res: Response) => {
  const analysis = analyzeSecurityHeaders(req);
  logger.info({
    requestId: req.id,
    score: analysis.score,
    missing: analysis.missing,
  }, 'Security headers analyzed');
  res.json(analysis);
});
```

Now logs reveal attacks:
```json
{"level":"info","ip":"192.168.1.100","source":"direct","trusted":true,"remoteAddress":"192.168.1.100","xff":"1.2.3.4","msg":"IP extracted"}
```

**Key insight:** `remoteAddress` is `192.168.1.100` (not a trusted proxy), so `X-Forwarded-For: 1.2.3.4` was correctly ignored. The returned IP is `192.168.1.100`. This log proves your validation is working.

Another scenario:
```json
{"level":"info","ip":"10.0.0.5","source":"x-forwarded-for","trusted":true,"remoteAddress":"10.0.0.1","xff":"10.0.0.5, 10.0.0.1","msg":"IP extracted"}
```

`remoteAddress` is `10.0.0.1` (trusted proxy). `XFF` chain is `10.0.0.5, 10.0.0.1`. We extract `10.0.0.5` as the real client. Correct.

## The Pain That Remains

You refactor `isValidIP` to support CIDR notation. You accidentally remove the `::1` check. Now IPv6 loopback is rejected. Your tests? None cover IPv6 loopback.

## What v5 Fixes

Testing. Every IP path, every header scenario, every security rule needs a test.
