# MD14 Monitoring Stack — v1 Simple JS

## Overview
A plain Node.js script with `console.log` as the only observability tool. No metrics, no alerts, no retention. We start here to show why `console.log` does not scale.

## Files
```
src/
  index.js
package.json
```

## Code Snippet
```javascript
// src/index.js
function handleRequest(req) {
  console.log(`Request received: ${req.url}`);
  // ... business logic ...
  console.log(`Request completed`);
}

setInterval(() => {
  console.log(`Memory: ${process.memoryUsage().heapUsed}`);
}, 5000);
```

## What We Learn
- `console.log` is unstructured, unqueryable, and lost on restart.
- Without counters or histograms, we cannot compute p99 latency or error rates.
- No alerting means we find out about outages from users, not metrics.

## Next Step
Add TypeScript (v2) so we can define metric types and alert rules with types.
