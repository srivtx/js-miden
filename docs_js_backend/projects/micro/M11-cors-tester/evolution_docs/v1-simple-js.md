# v1-simple-js.md — CORS Tester

## The Naive Beginning

We built an API with public and private endpoints. No CORS configuration — just Express defaults:

```javascript
// server.js
const express = require('express');
const app = express();

app.get('/public', (req, res) => {
  res.json({ message: 'Public data' });
});

app.get('/private', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing auth' });
  res.json({ message: 'Private data', user: 'admin' });
});

app.listen(3000);
```

## The Hidden Bug

**PAIN:** Without CORS headers, browser-based frontend apps **cannot call this API at all**. The browser blocks every cross-origin request with:

```
Access to fetch at 'http://api.example.com/public' from origin 'http://app.example.com'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header...
```

This isn't a server bug — the server returns 200 just fine with `curl`. But browsers enforce the Same-Origin Policy, so our API is unusable from a web app.

## Why We Added Complexity

We needed:
- **CORS headers** so browsers allow cross-origin requests
- **Different policies per route** (public = open, private = credentialed + restricted)
- **Preflight handling** so browsers can negotiate complex requests

> **Lesson:** CORS is a browser security feature. An API that works in `curl` can be completely broken for real users in a browser.
