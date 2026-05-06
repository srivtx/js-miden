# M33 UUID Service — v1 Simple JS

## The Naive Beginning

You need to generate UUIDs. The simplest thing: one endpoint that calls `crypto.randomUUID()`.

```js
// server.js
const express = require('express');
const crypto = require('crypto');
const app = express();

app.get('/uuid', (req, res) => {
  res.json({ uuid: crypto.randomUUID() });
});

app.listen(3000);
```

**"This works. It returns a UUID. Ship it."**

## The Pain in Production

### 1. Only v4, No Choice

Your database team wants time-ordered UUIDs (v7) for better index locality. Your frontend team wants ULIDs for lexicographic sorting. You only have v4. They build client-side workarounds that are inconsistent.

### 2. No Bulk Generation

A batch job needs 1000 UUIDs. It makes 1000 HTTP requests. Your server is overwhelmed. The job takes 30 seconds instead of 100ms.

### 3. No Validation

A client sends:
```bash
curl -X POST http://localhost:3000/uuid/bulk -d '{"count": 1000000}'
```

Your server tries to generate a million UUIDs and runs out of memory. No input validation rejects the absurd count.

### 4. Wrong Timestamp in v7

You try to add v7 support yourself:

```js
function uuidV7() {
  const timestamp = Math.floor(Date.now() / 1000); // BUG: seconds, not milliseconds
  const timeHex = timestamp.toString(16).padStart(12, '0');
  // ... rest of v7 structure
}
```

The timestamp is wrong by a factor of 1000. UUIDs are not time-ordered correctly. Database indexes fragment.

## What We Have

- **Single v4 endpoint** — no choice of format
- **No bulk generation** — N requests for N UUIDs
- **No validation** — can crash the server with large counts
- **Wrong v7 precision** — timestamp in seconds instead of milliseconds

## What v2 Fixes

TypeScript. Before we solve UUID generation, let's stop timestamp precision bugs from compiling.
