# Troubleshooting: Load Balancer

## Requests Fail Intermittently

**Symptom:** Every 3rd request returns `ECONNREFUSED`.

**Cause:** One backend is down, but the balancer still routes to it.

**Solution:** Implement health checks and filter unhealthy backends before selection.

## All Requests Fail

**Symptom:** Every request returns 502 or crashes.

**Cause:** All backends are down, and the balancer does not handle this case.

**Solution:** Check if `healthyBackends.length === 0` and return 503.

## Round-Robin Skips Backends

**Symptom:** Only 2 of 3 backends receive traffic.

**Cause:** A backend is marked unhealthy and removed from rotation.

**Solution:** Check health check logs to see why the backend is failing probes.

## Tests Fail with Connection Refused

**Symptom:** `npm test` fails on the unhealthy backend test.

**Cause:** This is expected due to the bug. The balancer does not skip unhealthy backends.

**Solution:** Fix the bug by implementing health checks in `src/health.ts`.
