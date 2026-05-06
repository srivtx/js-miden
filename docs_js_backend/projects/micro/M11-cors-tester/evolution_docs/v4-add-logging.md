# v4-add-logging.md — CORS Tester

## The Pain

In production, CORS issues were impossible to debug:

```typescript
app.use('/private', cors(privateCors), privateRouter);
```

1. A user reports: "The dashboard won't load." Browser dev tools show a CORS error, but the server logs say nothing.
2. Was the `Origin` header present? Unknown.
3. Was the preflight rejected? Unknown.
4. Did the CDN strip CORS headers? Unknown.

CORS failures happen in the **browser**, but the server has the data needed to diagnose them.

## The Fix: Add CORS Decision Logging

```typescript
// middleware/corsLogger.ts
import { logger } from '../logger.js';

export function corsLogger(req, res, next) {
  res.on('finish', () => {
    const corsHeaders = {
      allowOrigin: res.getHeader('access-control-allow-origin'),
      allowCredentials: res.getHeader('access-control-allow-credentials'),
      allowMethods: res.getHeader('access-control-allow-methods'),
    };

    logger.info({
      method: req.method,
      path: req.path,
      origin: req.headers.origin,
      corsHeaders,
      status: res.statusCode,
    }, 'CORS response');
  });
  next();
}
```

Now logs look like:
```json
{"level":30,"time":1715000000000,"method":"OPTIONS","path":"/private","origin":"https://evil.com","corsHeaders":{"allowOrigin":"https://app.example.com","allowCredentials":"true"},"status":403,"msg":"CORS response"}
```

This reveals:
- Which origins are being rejected
- Whether preflight responses match actual request responses
- If credentials headers are present when they shouldn't be

## But Logging Doesn't Fix Misconfiguration

The server might still send `Access-Control-Allow-Origin: *` with credentials. Logging makes it visible, but the config itself must be corrected (see v7).

> **Lesson:** CORS logging bridges the gap between browser errors and server state. But the fix is always in the CORS policy configuration.
