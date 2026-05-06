# v2: Add TypeScript — API Gateway

## The Pain

You write the gateway in JavaScript:

```javascript
// src/gateway.js
function createProxyMiddleware(targetUrl) {
  return (req, res, next) => {
    const url = new URL(targetUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: req.path,
      method: req.method,
      headers: req.headers,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.status(proxyRes.statusCode || 200);
      proxyRes.pipe(res);
    });

    req.pipe(proxyReq);
  };
}
```

Later, you use it:

```javascript
app.use('/users', createProxyMiddleware('http://localhost:3001'));
```

You refactor and accidentally change the parameter order:

```javascript
app.use(createProxyMiddleware('http://localhost:3001'), '/users');
```

JavaScript doesn't complain. Express treats the middleware as a path and vice versa. The gateway routes every request to the user service regardless of path. The order service is unreachable.

## The Solution

Add TypeScript. Type the Express middleware signature.

## After (With TypeScript)

```typescript
// src/gateway.ts
import { Request, Response, NextFunction } from 'express';
import http from 'http';

export function createProxyMiddleware(targetUrl: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const url = new URL(targetUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: req.path,
      method: req.method,
      headers: req.headers,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.status(proxyRes.statusCode || 200);
      Object.keys(proxyRes.headers).forEach((key) => {
        res.setHeader(key, proxyRes.headers[key]);
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.status(502).json({ error: 'Bad Gateway', message: err.message });
    });

    req.pipe(proxyReq);
  };
}
```

```typescript
// src/index.ts
import express, { Request, Response } from 'express';
import { createProxyMiddleware } from './gateway.js';

const app = express();

// TypeScript enforces: path string first, middleware second
app.use('/users', createProxyMiddleware('http://localhost:3001'));
app.use('/orders', createProxyMiddleware('http://localhost:3002'));

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});
```

## The Bug TypeScript Catches

- `app.use(createProxyMiddleware('...'), '/users')` → `No overload matches this call`
- `res.status('200')` → `Argument of type 'string' is not assignable to parameter of type 'number'`
- `proxyRes.headers[key]` → `Object is possibly 'undefined'` (forces optional chaining)
- `req.headers['x-request-id'] = requestId` → `OK` (but warns if header type is `IncomingHttpHeaders`)

## Why TypeScript Matters

- **Middleware order**: `app.use(path, ...handler)` is type-checked; swapping args is a compile error
- **HTTP types**: `statusCode: number | undefined` forces the `|| 200` fallback
- **Header safety**: `proxyRes.headers[key]` may be undefined; TypeScript forces handling
- **Refactoring**: Rename `createProxyMiddleware` and every `app.use` call updates

Without TypeScript, a swapped argument silently breaks routing. With TypeScript, the compiler rejects the call.
