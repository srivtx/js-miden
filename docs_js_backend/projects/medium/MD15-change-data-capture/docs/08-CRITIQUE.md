# Critic Review

## Technical Review
A senior engineer would say:
- "Simulating WAL with an application table is fine for learning, but in production you MUST use `pg_recvlogical`."
- "No dead-letter queue for failed events. If `handleCacheUpdate` throws, the entire batch is lost."
- "No schema evolution. If the `users` table adds a column, consumers may break."
- "PostgreSQL `BIGSERIAL` can still overflow eventually. Use `UUID` or `SNOWFLAKE_ID` for eternal event logs."

## Security Review
- **SQL Injection**: `publishChange` uses parameterized queries (safe), but raw `query()` in routes could be misused.
- **Event Tampering**: No authentication on the API. Anyone can insert/delete rows and trigger events.
- **Data Leakage**: `before_json` and `after_json` may contain PII. Encryption at rest is needed.

## Educational Review
- **What's missing**: Backpressure. If consumers are slow, events pile up. No `max_lag` monitoring.
- **What's confusing**: The difference between `pg_logical` slots and our simulated `cdc_events` table isn't clearly documented in code comments.
- **Suggested addition**: A diagram showing exactly how PostgreSQL physical WAL maps to logical change events.

## Fixes Applied
- Added `cdc_offsets` table for persistent offsets.
- Added sequential `BIGSERIAL` LSN generation.
- Added `getLatestLsn()` for offset validation. (Still needs to be called in `pollAndDispatch`.)
