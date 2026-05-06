# Architecture: Circuit Breaker

## State Machine

```
        Failure threshold reached
   +-----------------------------+
   |                             |
   v                             |
[ CLOSED ] ----failure----> [ OPEN ]
   ^    ^                       |
   |    |                       | 30s timeout
   |    |                       v
   |    +----------+      [ HALF-OPEN ]
   |               success    |
   +---------------------------+
                failure
```

## Components

### CircuitBreaker Class
- Maintains state and failure history
- Executes wrapped functions
- Manages state transitions

### Failure Record
- Timestamp of each failure
- Used for rolling window calculation

### Express Routes
- `/api/external` - Uses breaker.execute()
- `/simulate/fail` - Controls test failure mode
- `/health` - Exposes state and metrics

## Data Flow

1. Client requests `/api/external`
2. Server calls `breaker.execute(apiCall)`
3. Breaker checks state
4. If closed: execute API call
   - Success: clear failures
   - Failure: record failure, check threshold
5. If open: return 503 immediately
6. If half-open: allow 1 test request
   - Success: close circuit
   - Failure: open circuit

## Timeouts

Every request must have a timeout to prevent indefinite hangs. The timeout should be shorter than the half-open timeout.
