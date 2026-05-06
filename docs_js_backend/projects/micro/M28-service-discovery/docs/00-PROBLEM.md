# 00-PROBLEM: Service Discovery

## WHAT is the problem?

Service Discovery is the mechanism that allows services to find each other in a dynamic environment. The problem is that **without heartbeat cleanup and TTL filtering**, the registry fills with dead services, causing clients to receive stale addresses and fail to connect.

## WHY does this matter?

- **Failed connections**: Clients discover URLs of crashed services and get `ECONNREFUSED`.
- **Memory leak**: The registry grows unbounded as services start, crash, and restart with new IDs.
- **Slow discovery**: Querying a bloated registry increases latency.
- **False scaling**: A client may think 10 instances are available when only 3 are alive.

## HOW does the bug manifest?

The current `src/registry.ts` returns **all services** regardless of when they last heartbeated:

```typescript
export function getServices(name: string): Service[] {
  // BUG: No TTL filtering! Dead services are returned.
  return registry.filter(s => s.name === name);
}
```

And `src/heartbeat.ts` has a `cleanup()` function that is **never invoked** because `startCleanup()` is commented out.

## WRONG vs RIGHT

| Aspect | WRONG (Current) | RIGHT (Fixed) |
|--------|-----------------|---------------|
| Cleanup | Never runs | `setInterval` every 1.5s |
| TTL filtering in discovery | None | Filter `now - lastHeartbeat <= TTL` |
| Memory growth | Unbounded | Bounded by active service count |
| Client experience | Random connection failures | Only healthy addresses returned |

## ASCII Diagram: The Ghost Registry

```
Service A          Registry               Client
  |                   |                      |
  |-- Register ----->|                      |
  |                   | [A: alive]           |
  |-- Heartbeat ---->|                      |
  |                   |                      |
  (A crashes)         |                      |
  |                   | [A: DEAD but still   |
  |                   |  in registry]        |
  |                   |                      |-- Discover A -->
  |                   |                      |
  |                   |                      |<-- [A, B, C] ---
  |                   |                      |
  |                   |                      |-- Connect to A --X
  |                   |                      |   ECONNREFUSED
```

## Real-World Impact

In 2019, a ride-sharing company's service discovery registry (a custom Consul alternative) failed to evict dead driver-location services during a deploy. Riders saw 40% of their requests timeout because they were routed to old container IPs. The incident lasted 23 minutes and triggered a $50K SLA payout.
