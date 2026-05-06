# A10 Evolution: v1 — Simple JavaScript

## State of the System

The API is a single Express instance running in one region (`us-east`). It stores all data in an in-memory JavaScript `Map`. There is no replication, no routing, and no concept of regions.

## What Works

- `POST /data/:id` stores a JSON value under an ID.
- `GET /data/:id` retrieves the value.
- `DELETE /data/:id` removes it.

## What Does NOT Work

- **Single point of failure.** If the `us-east` process restarts, all data is lost. There is no persistence, no backup, and no replication.
- **Global latency.** A user in London experiences ~80 ms of network round-trip before any application logic runs. For write-heavy workloads (shopping carts, gaming state), this is unacceptable.
- **No conflict detection.** If two clients update the same ID concurrently, the last write wins silently. One update is lost forever with no trace.
- **No partition tolerance.** If the datacenter loses network connectivity, the entire API is unreachable. There is no fallback region.
- **No routing intelligence.** Every user, regardless of geography, hits the same IP. There is no GeoDNS, no latency-based selection, and no session stickiness.

## Code Snapshot (index.js)

```javascript
const express = require('express');
const app = express();
app.use(express.json());

const store = new Map();

app.post('/data/:id', (req, res) => {
  store.set(req.params.id, req.body.value);
  res.json({ success: true });
});

app.get('/data/:id', (req, res) => {
  res.json({ value: store.get(req.params.id) });
});

app.listen(3000);
```

## Architectural Notes

This is the "single region" stage. It is simple, strongly consistent, and easy to reason about, but it violates the constraints of a global user base. The CAP theorem is irrelevant because there is only one node — consistency and availability are trivial, but partition tolerance and low latency for remote users are impossible.

## Migration Path to v2

1. Introduce the concept of regions (`us-east`, `us-west`, `eu-west`) as separate deployable units.
2. Add vector-clock metadata to every record so concurrent updates can be detected.
3. Implement asynchronous replication so each region accepts local writes and forwards them to peers.
