# M16 Redirector — v1 Simple JS

## The Naive Implementation

You need an endpoint that redirects users to a URL. Simple:

```js
// app.js
const express = require('express');
const app = express();
app.use(express.json());

app.post('/redirect', (req, res) => {
  const { url } = req.body;
  res.redirect(url); // 302 by default
});

app.listen(3000);
```

Works locally:
```bash
curl -X POST http://localhost:3000/redirect \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
# → 302 Redirect to https://example.com
```

## The Pain in Production

### 1. Open Redirect Vulnerability

```bash
curl -X POST http://localhost:3000/redirect \
  -d '{"url":"https://evil.com/phishing"}'
```

Your domain is now a redirector for phishing attacks. Attackers send:
```
https://your-trusted-site.com/redirect?url=https://evil.com
```

Users trust your domain. They land on evil.com.

### 2. No Protocol Validation

```bash
curl -X POST http://localhost:3000/redirect \
  -d '{"url":"javascript:alert(1)"}'
```

XSS via redirect. Some browsers execute JavaScript schemes in redirect contexts.

### 3. No Status Code Awareness

Always 302. What if you need a permanent redirect (301)? What if you need 307/308 to preserve the request method? Your API is one-size-fits-none.

### 4. No Input Validation

Missing `url` field? `res.redirect(undefined)` — Express throws or redirects to `/undefined`. Wrong content type? `req.body` is empty. No errors, no feedback.

## The Lesson

A "simple" redirector is a reputation killer. Without URL validation, you're a phishing launchpad. Without status code control, you're inflexible. Without input validation, you're brittle.

## What v2 Fixes

TypeScript. Let's stop guessing what `req.body` contains.
