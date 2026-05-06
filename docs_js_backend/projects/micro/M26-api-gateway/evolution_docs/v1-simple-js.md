# v1: Simple JS — API Gateway

## The Pain

Your frontend calls two backend services directly:

```javascript
// frontend.js
const users = await fetch('http://localhost:3001/users');
const orders = await fetch('http://localhost:3002/orders');
```

It works. Then you add a third service. The frontend now knows 3 URLs. You deploy the payment service on port 3003. You update the frontend. Users with cached JS still call port 3002. They get 404s. You clear the CDN cache. Some users have the old app version. They keep getting 404s.

Then you need auth. You add JWT validation to every backend. Now you have 3 auth implementations, each slightly different. One allows expired tokens. Another doesn't check the issuer. A security audit finds 3 different bugs.

## The Solution (v1)

Build a simple proxy gateway.

```javascript
// src/index.js
const express = require('express');
const http = require('http');

const app = express();

function createProxy(targetUrl) {
  return (req, res) => {
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

app.use('/users', createProxy('http://localhost:3001'));
app.use('/orders', createProxy('http://localhost:3002'));

app.listen(3000, () => {
  console.log('API Gateway running on port 3000');
});
```

## What's Still Broken (and Why We Evolve)

- **No types**: `req` and `res` are untyped. Typos in `statusCode` are silent.
- **No validation**: `htp://localhost:3001` crashes the gateway.
- **No timeout**: Slow backends hang forever.
- **No error handling**: Backend down = gateway crash.
- **No logging**: You can't trace requests.
- **No tests**: Refactoring proxy logic is risky.
- **CJS**: `require()` is legacy.
- **No request IDs**: You can't correlate logs across services.
- **No circuit breaker**: Dead backends get all traffic.
- **No auth**: Anyone can hit any route.

This is v1. It solves the "frontend knows 5 backend URLs" pain. It introduces new pains that v2-v7 will fix.
