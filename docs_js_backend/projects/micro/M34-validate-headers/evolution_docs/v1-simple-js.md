# M34 Validate Headers — v1 Simple JS

## The Naive Beginning

You need an API. The simplest thing: trust the client.

```js
// server.js
const express = require('express');
const app = express();
app.use(express.json());

app.get('/public', (req, res) => {
  res.json({ message: 'public endpoint' });
});

app.post('/private', (req, res) => {
  res.json({ message: 'private endpoint' });
});

app.listen(3000);
```

**"This works. No validation needed. Ship it."**

## The Pain in Production

### 1. Missing Content-Type Causes Parsing Errors

A client sends a POST with `Content-Type: image/png`. Your `express.json()` middleware ignores it. `req.body` is `{}`. The endpoint processes an empty body as valid. Data is silently lost.

### 2. Malformed Authorization Headers

A client sends:
```
Authorization: Basic dXNlcjpwYXNz
```

Your endpoint expects Bearer tokens. It doesn't validate the format. It tries to parse `Basic` as a JWT. The parser throws. The server returns 500 instead of 400.

### 3. Case-Sensitivity Bugs

A client sends:
```
content-type: application/json
authorization: Bearer token123
```

Your code checks `req.headers['Content-Type']`. It gets `undefined` because Node.js lowercases header keys. You reject a valid request. Users are confused.

### 4. Custom Headers Are Unvalidated

A webhook sends `X-Signature: abc123`. Your endpoint doesn't check the format. An attacker sends `X-Signature: <script>`. You log it verbatim. XSS.

## What We Have

- **No validation** — accepts any header value
- **Case-sensitive lookup** — rejects valid lowercase headers
- **No format checking** — malformed auth tokens crash the parser
- **No strict/lenient modes** — can't warn vs reject

## What v2 Fixes

TypeScript. Before we solve validation, let's stop header access typos from compiling.
