# MD12 Realtime Analytics — v1 Simple JS

## Overview
A bare-bones Express app with no tracking at all. Routes exist (`GET /health`, `POST /echo`), but there is no concept of events, counters, or time-series. We start here to establish the baseline.

## Files
```
src/
  server.js
  routes/
    index.js
package.json
```

## Code Snippet
```javascript
// src/server.js
const express = require('express');
const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/echo', (req, res) => res.json(req.body));

app.listen(3000, () => console.log('Server running'));
```

## What We Learn
- Without explicit instrumentation, we have zero visibility into user behavior or system health.
- Adding ad-hoc `console.log` is not scalable.

## Next Step
Add TypeScript (v2) so we can model events and aggregation windows with types.
