# M21 Circuit Breaker — v1 Simple JS

## The Naive Implementation

You need to call an external API. Simple:

```js
// app.js
const express = require('express');
const app = express();

app.get('/api/external', async (req, res) => {
  const response = await fetch('https://api.example.com/data');
  const data = await response.json();
  res.json(data);
});

app.listen(3000);
```

Works locally:
```bash
curl http://localhost:3000/api/external
# → { "data": "success" }
```

## The Pain in Production

### 1. No Error Handling

```js
const response = await fetch('https://api.example.com/data');
```

If the API is down, `fetch()` throws after... wait, what's the timeout? Node.js `fetch()` default timeout is **no timeout** (or platform-dependent). Your request hangs forever. Your event loop is blocked. Your server stops responding to other requests.

### 2. No Retry Logic

The external API has a transient blip (500ms of packet loss). Your code throws immediately. The user sees an error. You could have retried once and succeeded.

### 3. Cascading Failures

The external API is slow (10s response time). Your users retry aggressively. Each retry opens a new connection. Now you have 1000 open connections to a failing API. Your server runs out of file descriptors. Your database connection pool exhausts. Everything falls down.

### 4. No Backoff

You add naive retry:
```js
for (let i = 0; i < 3; i++) {
  try {
    return await fetch(url);
  } catch (e) {
    // Retry immediately
  }
}
```

The API is overloaded. Your immediate retries hammer it harder. It never recovers. You're part of the DDoS.

### 5. No Circuit Breaker

The external API is down for 30 minutes. Every request to your API triggers a new failing request to the external API. You waste resources, timeout users, and prevent the external API from recovering under the load of your retries.

## The Lesson

Naive HTTP calls are fragile. Without timeouts, retries, backoff, and circuit breaking, a single slow dependency will cascade into a total system outage.

## What v2 Fixes

TypeScript. Before we build resilience, let's get the types right.
