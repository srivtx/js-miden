# M19 Header Inspector — v1 Simple JS

## The Naive Implementation

You need an API that inspects HTTP headers for debugging. Simple:

```js
// app.js
const express = require('express');
const app = express();

app.get('/headers', (req, res) => {
  res.json({ headers: req.headers });
});

app.get('/ip', (req, res) => {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    const first = xff.split(',')[0]?.trim();
    res.json({ ip: first, source: 'x-forwarded-for', trusted: true });
  } else {
    res.json({ ip: req.socket.remoteAddress, source: 'direct', trusted: true });
  }
});

app.get('/security', (req, res) => {
  const headers = req.headers;
  res.json({ present: Object.keys(headers), missing: [] });
});

app.listen(3000);
```

Works locally:
```bash
curl http://localhost:3000/ip
# → { "ip": "127.0.0.1", "source": "direct", "trusted": true }
```

## The Pain in Production

### 1. Blind Trust of X-Forwarded-For

```bash
curl http://your-production-api.com/ip \
  -H "X-Forwarded-For: 1.2.3.4"
```

Your API returns `{ "ip": "1.2.3.4", "trusted": true }`. An attacker spoofed their IP. If you use this IP for rate limiting, logging, or geo-location, you're compromised.

**Why this happens:** In production, your app sits behind a load balancer or CDN. The proxy sets `X-Forwarded-For: <real-client-ip>, <proxy-ip>`. But if a request comes directly (bypassing the proxy), the attacker can set any IP they want. Your code trusts the header unconditionally.

### 2. No Security Headers on Responses

Your API responses have no:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`
- `Referrer-Policy`

Your "debugging" API can be framed in a clickjacking attack. MIME sniffing can lead to XSS. No CSP means inline scripts execute freely.

### 3. No Proxy Awareness

`req.socket.remoteAddress` in production is the load balancer's IP, not the client's. If you don't check `X-Forwarded-For`, every request appears to come from `10.0.0.5`.

### 4. No Header Validation

A malformed `X-Forwarded-For: not-an-ip` is passed through as-is. Your rate limiter crashes. Your geo-IP library throws.

## The Lesson

Headers are a trust boundary. `X-Forwarded-For` is user-input when it reaches your app. Without proxy awareness, IP validation, and security headers, you're vulnerable to spoofing, clickjacking, and information leakage.

## What v2 Fixes

TypeScript. Stop treating headers as `any`.
