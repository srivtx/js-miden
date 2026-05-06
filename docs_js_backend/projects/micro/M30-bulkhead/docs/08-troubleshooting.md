# Troubleshooting: Bulkhead Pattern

## Critical Requests Rejected

**Symptom:** User-facing API returns 503 even though the system is not overloaded.

**Cause:** Background jobs are consuming shared pool slots.

**Solution:** Create separate pools for critical and background workloads.

## Pool Slots Never Free

**Symptom:** After some time, all requests are rejected even when no work is running.

**Cause:** Slots are not released when requests error or time out.

**Solution:** Use `.finally(() => pool.release())` to ensure release in all cases.

## Background Jobs Starved

**Symptom:** Background jobs are always rejected.

**Cause:** Critical requests are consuming all shared pool slots.

**Solution:** Separate pools so each workload has its own dedicated capacity.

## Tests Fail on Isolation

**Symptom:** `npm test` shows that filling the background pool blocks critical requests.

**Cause:** This is expected due to the bug. Both routes use the same pool.

**Solution:** Fix the bug by creating independent pools in `src/pool.ts`.
