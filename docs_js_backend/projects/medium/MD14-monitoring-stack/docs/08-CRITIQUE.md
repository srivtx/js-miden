# Critic Review

## Technical Review
A senior engineer would say:
- "In-memory store is fine for a single node, but where's the WAL? Crash = lose everything."
- "No histogram bucket configuration. Default buckets for HTTP latencies are often wrong."
- "Alert engine runs synchronously on GET /alerts/states. It should be a background job."
- "Missing rate() function. A counter value of 1000 is meaningless without knowing if that's per second or per hour."

## Security Review
- **Denial of Service**: `/metrics` endpoint accepts arbitrary labels. An attacker can send millions of unique labels to OOM the server.
- **Information Disclosure**: `/dashboard/series` exposes all metric names and labels. Could leak internal service names.
- **No Auth**: Anyone can create alert rules or delete data.

## Educational Review
- **What's missing**: Exemplars (linking metrics to traces), recording rules (pre-aggregated queries), federation.
- **What's confusing**: The difference between counters (monotonically increasing) and gauges (arbitrary values) isn't enforced in code.
- **Suggested addition**: A `rate()` and `increase()` query function to make counter metrics useful.

## Fixes Applied
- Added `pruneOldData()` with manual trigger. (Still needs automatic scheduling.)
- Added `getSeriesCount()` for visibility. (Still needs cardinality limits.)
