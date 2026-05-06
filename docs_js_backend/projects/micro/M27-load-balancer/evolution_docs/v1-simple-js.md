# v1: Simple JS — Load Balancer

## The Pain

Your API runs on one server:

```javascript
// src/index.js
app.listen(3000);
```

It gets popular. CPU hits 100%. Requests time out. You add a second server:

```javascript
// frontend.js
const servers = ['http://localhost:3001', 'http://localhost:3002'];
let current = 0;

function fetchData() {
  const url = servers[current % servers.length];
  current++;
  return fetch(url);
}
```

It works. Then server 2 dies. Half of your requests fail. Users see 502 errors. You restart server 2. It takes 30 seconds. During those 30 seconds, 50% of requests fail. You have no way to know server 2 is down except by watching user complaints.

## The Solution (v1)

Build a simple round-robin load balancer.

```javascript
// src/balancer.js
const backends = [
  { port: 3001, healthy: true },
  { port: 3002, healthy: true },
];

let counter = 0;

function selectBackend() {
  if (backends.length === 0) return null;
  const backend = backends[counter % backends.length];
  counter++;
  return backend;
}

module.exports = { selectBackend, backends };
```

```javascript
// src/index.js
const express = require('express');
const http = require('http');
const { selectBackend } = require('./balancer');

const app = express();

app.all('*', (req, res) => {
  const backend = selectBackend();
  if (!backend) {
    return res.status(503).json({ error: 'No backends available' });
  }

  const options = {
    hostname: 'localhost',
    port: backend.port,
    path: req.path,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode || 200);
    proxyRes.pipe(res);
  });

  req.pipe(proxyReq);
});

app.listen(3000, () => {
  console.log('Load balancer running on port 3000');
});
```

## What's Still Broken (and Why We Evolve)

- **No types**: `backends` is untyped. `port: "3001"` is accepted.
- **No validation**: `port: 999999` crashes on proxy.
- **No health checks**: Dead backends get 50% of traffic.
- **No logging**: You can't see routing decisions.
- **No tests**: Refactoring selection logic is risky.
- **CJS**: `require()` is legacy.
- **No weights**: A 16-core server gets the same traffic as a 2-core server.
- **No least-connections**: Long requests block a backend while others sit idle.
- **No passive health checks**: 502s don't mark backends unhealthy.

This is v1. It solves the "single server = single point of failure" pain. It introduces new pains that v2-v7 will fix.
