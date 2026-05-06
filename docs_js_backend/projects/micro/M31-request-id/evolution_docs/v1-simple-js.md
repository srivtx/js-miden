# M31 Request ID — v1 Simple JS

## The Naive Beginning

You need to trace requests through your API. The simplest thing: don't bother.

```js
// server.js
const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  console.log('health check');
  res.json({ status: 'ok' });
});

app.get('/data', async (req, res) => {
  console.log('fetching data');
  res.json({ data: [1, 2, 3] });
});

app.listen(3000);
```

**"This works. It returns data. Why do I need IDs?"**

## The Pain in Production

### 1. Log Lines Interleave

Two requests arrive at the same time:

```
Request A: health check
Request B: fetching data
Request A: data: [1,2,3]
Request B: status: ok
```

You can't tell which log line belongs to which request. A failure in one request pollutes the other's trace.

### 2. No Downstream Correlation

Your API calls a downstream service. The downstream logs show an error. You have no way to find which upstream request triggered it. The timestamps are close but not exact.

### 3. No Error Context

A user reports a 500 error at 14:23:07. Your logs show five 500 errors between 14:23:00 and 14:23:30. Which one is theirs? You can't tell. You ask them to reproduce it.

### 4. Support Tickets Are Guessing Games

*"My request failed."* — Which request? When? From which IP? Without an ID, you ask the user for their IP, approximate time, and request path. Then you grep logs and hope.

## What We Have

- **No request IDs** — can't trace a single request
- **Unstructured logs** — `console.log` with no context
- **No downstream propagation** — downstream errors are orphans
- **No error correlation** — support is a guessing game

## What v2 Fixes

TypeScript. Before we solve tracing, let's stop typos from breaking our middleware.
