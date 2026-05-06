# v1: Simple JS — Retry Logic

## The Pain

You fetch data from a third-party API:

```javascript
// src/api.js
const response = await fetch('https://api.example.com/data');
const data = await response.json();
```

It fails with `ECONNRESET`. Your user sees an error. You add a retry:

```javascript
let data;
for (let i = 0; i < 3; i++) {
  try {
    const response = await fetch('https://api.example.com/data');
    data = await response.json();
    break;
  } catch (err) {
    if (i === 2) throw err;
    await new Promise(r => setTimeout(r, 1000));
  }
}
```

It works. Then the API is down for 30 seconds. Your 3 retries happen at 0s, 1s, 2s. All fail. You throw an error. Then 1,000 users all retry at exactly the same time when the API comes back. The API crashes again. This is the thundering herd.

## The Solution (v1)

Extract retry logic to a reusable client.

```javascript
// src/retry-logic.js
class RetryClient {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelayMs = options.baseDelayMs || 1000;
  }

  async fetch(url) {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return { status: response.status, data: await response.text() };
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          await new Promise(r => setTimeout(r, this.baseDelayMs));
        }
      }
    }
    throw lastError;
  }
}

module.exports = { RetryClient };
```

```javascript
// src/index.js
const express = require('express');
const { RetryClient } = require('./retry-logic');

const app = express();
const client = new RetryClient({ maxRetries: 3, baseDelayMs: 1000 });

app.get('/fetch', async (req, res) => {
  try {
    const result = await client.fetch(req.query.url);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log('Retry logic service running on port 3000');
});
```

## What's Still Broken (and Why We Evolve)

- **No types**: `new RetryClient({ maxRetries: '3' })` is accepted.
- **No validation**: `maxRetries: -1` means no retries ever.
- **Fixed delay**: All retries at 1s intervals. Thundering herd on recovery.
- **No jitter**: Synchronized retries overwhelm the backend.
- **No timeout**: Slow requests hang forever.
- **Retries 4xx**: `404` is retried 3 times, wasting resources.
- **No logs**: You can't trace retry behavior.
- **No tests**: Refactoring retry logic is risky.
- **CJS**: `require()` is legacy.
- **No idempotency**: Retrying a POST may create duplicates.

This is v1. It solves the "single failure = user error" pain. It introduces new pains that v2-v7 will fix.
