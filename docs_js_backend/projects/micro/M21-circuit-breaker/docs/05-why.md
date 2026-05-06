# WHY: Circuit Breaker

## The Problem

In distributed systems, a failing downstream service can cause cascading failures:

1. Service A calls Service B
2. Service B is slow/failing
3. Service A threads accumulate waiting for B
4. Service A runs out of threads/memory
5. Service A fails, affecting Service C that depends on A
6. Cascading failure takes down the entire system

## Why Circuit Breakers Help

### 1. Fail Fast
Instead of waiting 30 seconds for a timeout, return 503 in 1ms. This preserves resources.

### 2. Prevent Cascading Failures
By failing fast, the caller doesn't exhaust resources, preventing the failure from spreading.

### 3. Give Downstream Services Recovery Time
When the circuit is open, no requests reach the failing service. This gives it time to recover without being overwhelmed.

### 4. Graceful Degradation
Applications can provide fallback behavior when a circuit is open:
- Return cached data
- Return default values
- Disable non-critical features

## Without Circuit Breakers

```
User -> API Gateway -> Orders Service -> Payment Service (down)
                           ^
                           |
                    1000 requests queued
                    API Gateway: 504 Gateway Timeout
                    Orders Service: Out of Memory
                    Entire system down
```

## With Circuit Breakers

```
User -> API Gateway -> Orders Service -> [Circuit OPEN] -> 503
                           |
                    Returns "Payment unavailable, retry later"
                    System remains stable
```

## Business Impact

- **Availability**: System stays up during partial outages
- **User Experience**: Fast failure with helpful message vs. long timeout
- **Cost**: Fewer resources wasted on doomed requests
- **MTTR**: Faster recovery because failing service isn't overloaded
