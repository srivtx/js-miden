# M32 Content Negotiation — v1 Simple JS

## The Naive Beginning

You need an API that returns data. The simplest thing: always return JSON.

```js
// server.js
const express = require('express');
const app = express();

app.get('/resource', (req, res) => {
  res.json({ message: 'Hello' });
});

app.listen(3000);
```

**"This works. Everyone wants JSON. Ship it."**

## The Pain in Production

### 1. Browsers Get JSON They Can't Render

A user opens `http://api.example.com/resource` in their browser. They see:

```json
{"message":"Hello"}
```

Raw JSON. Not helpful. They expected HTML. Your API ignores the browser's `Accept: text/html` header.

### 2. IoT Devices Can't Parse JSON

An embedded device calls your API with `Accept: text/plain`. It gets JSON. Its parser throws. The device reboots in a loop. You get angry emails from hardware engineers.

### 3. Mobile Apps Need XML for Legacy Integration

Your mobile app integrates with an enterprise system that only speaks XML. Your API returns JSON. The integration fails. The client has to build a translation proxy.

### 4. No Quality Values

A client sends:
```
Accept: application/json;q=0.8, text/html;q=1.0
```

They prefer HTML. You ignore the `q` values and return JSON anyway. The client renders raw JSON to the user.

## What We Have

- **Hardcoded JSON** — ignores client preferences
- **No Accept parsing** — treats all clients the same
- **No quality values** — can't express preference strength
- **No wildcards** — `*/*` causes a fallback mismatch

## What v2 Fixes

TypeScript. Before we solve negotiation, let's stop format strings from being silently mistyped.
