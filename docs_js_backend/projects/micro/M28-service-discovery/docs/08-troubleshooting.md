# Troubleshooting: Service Discovery

## Discovered Services Are Unreachable

**Symptom:** `GET /discover/my-service` returns URLs that return `ECONNREFUSED`.

**Cause:** Dead services are not removed from the registry.

**Solution:** Implement heartbeat cleanup in `src/heartbeat.ts`.

## Service Disappears Immediately

**Symptom:** A service registers but is gone on the next discovery query.

**Cause:** Cleanup interval is too aggressive, or heartbeat TTL is too short.

**Solution:** Increase `HEARTBEAT_TTL` or ensure the service is heartbeating frequently enough.

## Duplicate Service IDs

**Symptom:** Two services share the same ID.

**Cause:** IDs are not truly unique (e.g., using a counter instead of UUID).

**Solution:** Use `crypto.randomUUID()` for IDs.

## Tests Fail on Stale Cleanup

**Symptom:** `npm test` shows dead services still in discovery results.

**Cause:** This is expected due to the bug. No cleanup runs.

**Solution:** Fix the bug by adding `setInterval(cleanup, ...)` in `src/heartbeat.ts`.
