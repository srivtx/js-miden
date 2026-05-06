# v1-simple-js.md — Request Logger

## The Naive Beginning

We needed to see what requests hit our API. The simplest approach: `console.log` inside every route:

```javascript
// server.js
const express = require('express');
const app = express();
app.use(express.json());

app.post('/login', (req, res) => {
  console.log('POST /login', req.body);
  const { username, password } = req.body;
  if (username === 'admin' && password === 'secret') {
    return res.json({ token: 'fake-jwt' });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/health', (req, res) => {
  console.log('GET /health');
  res.json({ status: 'ok' });
});

app.listen(3000);
```

## The Hidden Bug

**PAIN:** This "simple" logging causes two production nightmares:

1. **Sensitive data leaks:** Every login request writes the plaintext password to stdout:
   ```
   POST /login { username: 'admin', password: 'secret' }
   ```
   Logs are often shipped to log aggregation services (Datadog, Splunk, CloudWatch). Your users' passwords now live in third-party systems, potentially forever.
2. **No structure:** Logs are plain text. You can't query by status code, duration, or path. Finding all 500 errors in the last hour means grepping unstructured text.

## Why We Added Complexity

We needed:
- **Structured JSON logs** so log aggregators can index and query fields
- **Sensitive data redaction** so passwords and tokens never leave the system
- **Async logging** so I/O doesn't block the event loop under load

> **Lesson:** `console.log` is a debugging tool, not a production logging strategy. It leaks secrets and produces unqueryable text.
