# 01-THINKING: Service Discovery

## WHAT is the mental model?

Service Discovery is a **distributed phone book with expiration dates**. Services "publish" their number when they start, "refresh" it periodically, and "vanish" when they stop refreshing. Clients only trust entries that have been refreshed recently.

## WHY does this mindset matter?

In a static datacenter, you could hardcode IP addresses. In Kubernetes, AWS, or any elastic environment, IPs are ephemeral. The only truth is: **a service is alive if and only if it has heartbeated within TTL seconds**.

## HOW do we reason about discovery design?

### The Registry Contract

1. **Register**: Service sends `POST /register { name, url }` → gets an ID.
2. **Heartbeat**: Service sends `POST /heartbeat/:id` every N seconds.
3. **Cleanup**: Registry scans every M seconds and removes entries where `now - lastHeartbeat > TTL`.
4. **Discover**: Client sends `GET /discover/:name` and receives only non-expired entries.
5. **Deregister**: Service can explicitly deregister on graceful shutdown.

```
┌─────────────┐   Register   ┌─────────────┐
│   Service   │─────────────▶│   Registry  │
│   (User)    │ Heartbeat    │   :3000     │
└─────────────┘◀─────────────└──────┬──────┘
                                    │
                              Discover│
                                    ▼
                            ┌─────────────┐
                            │   Client    │
                            │  (Order)    │
                            └─────────────┘
```

## WRONG vs RIGHT Thinking

| WRONG Mindset | RIGHT Mindset |
|---------------|---------------|
| "Once registered, always registered." | "Registration is a lease, not a deed." |
| "Heartbeats are optional." | "Heartbeats are the heartbeat of the system." |
| "Cleanup is a nice-to-have." | "Cleanup is as critical as registration." |
| "Clients should handle dead services." | "The registry should never serve dead addresses." |

## Decision Checklist

- [ ] Is there a TTL for every registered service?
- [ ] Is there a cleanup job running at a regular interval?
- [ ] Does discovery filter out expired entries?
- [ ] Can services deregister gracefully?
- [ ] Is the registry replicated for high availability?
