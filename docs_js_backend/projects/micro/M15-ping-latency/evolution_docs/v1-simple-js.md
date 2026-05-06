# M15 Ping API — v1 Simple JS

## The Naive Implementation

You need an endpoint that pings a host and measures latency. Easy:

```js
// app.js
const express = require('express');
const http = require('http');
const app = express();

app.get('/ping', (_req, res) => {
  res.json({ message: 'pong' });
});

app.get('/latency', async (req, res) => {
  const target = req.query.target;
  const start = Date.now();

  http.get(target, (response) => {
    const latency = Date.now() - start;
    res.json({ target, latencyMs: latency });
  }).on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

app.listen(3000);
```

Works locally:
```
curl "http://localhost:3000/latency?target=http://example.com"
→ { "target": "http://example.com", "latencyMs": 45 }
```

## The Pain in Production

### 1. SSRF — Server-Side Request Forgery

```
curl "http://localhost:3000/latency?target=http://localhost:3000/admin"
```

Your latency endpoint hits internal services. No validation means attackers can scan your internal network.

### 2. DNS Resolution? What DNS?

`http.get('http://169.254.169.254')` — AWS metadata endpoint. Bypasses any naive IP block because you never resolved DNS. An attacker uses a domain they control that resolves to `169.254.169.254`.

### 3. No Timeout

A target host that drops packets causes the request to hang indefinitely. Node's default `http.get()` timeout is **no timeout**. Your event loop is blocked. Your app stops responding.

### 4. No Error Handling for Invalid Input

```
curl "http://localhost:3000/latency?target=not-a-url"
```

Crashes or returns confusing errors. `req.query.target` might be an array, undefined, or a string.

## The Lesson

A "simple" ping endpoint in production is an attack surface. Without SSRF protection, DNS resolution validation, and timeouts, you're giving attackers a proxy into your internal network and a DoS vector against your own server.

## What v2 Fixes

TypeScript. Before we even think about security, let's stop shooting ourselves in the foot with type errors.
