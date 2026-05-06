# 01-THINKING: API Gateway

## WHAT is the mental model?

An API Gateway is a **reverse proxy with policy**. It is not just a router; it is the **resilience boundary** between the internet and your services. Every decision at the gateway layer affects availability, latency, and cost.

## WHY do we think about it this way?

The gateway is the **last line of defense** before untrusted client traffic hits internal services. If the gateway is fragile, the entire system is fragile. The core insight is: **treat every outbound network call as unreliable**.

## HOW do we reason about gateway design?

### The "What If" Game

1. **What if the backend is slow?** → Timeout after N seconds.
2. **What if the backend is down?** → Return 502, don't crash.
3. **What if the backend returns garbage?** → Validate or pass through with sanitization.
4. **What if the client is malicious?** → Rate limit, authenticate, size limits.

### Statelessness

The gateway must be **stateless** to scale horizontally. No session affinity, no in-memory state that can't be rebuilt.

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Client  │────▶│  LB     │────▶│Gateway 1│
└─────────┘     │         │     └─────────┘
                │         │     ┌─────────┐
                │         │────▶│Gateway 2│
                └─────────┘     └─────────┘
```

## WRONG vs RIGHT Thinking

| WRONG Mindset | RIGHT Mindset |
|---------------|---------------|
| "The backend is always fast." | "Every backend will eventually be slow or dead." |
| "Errors are exceptional." | "Errors are the normal case at scale." |
| "One gateway node is enough." | "Gateway must scale out; statelessness is mandatory." |
| "We can add timeouts later." | "Timeouts are a first-class requirement, not an afterthought." |

## Decision Checklist

- [ ] Is there a timeout on every outbound request?
- [ ] Is there an error handler on every outbound request?
- [ ] Can the gateway run N instances behind a load balancer?
- [ ] Are request IDs injected for distributed tracing?
- [ ] Is there a circuit breaker to prevent retry storms?
