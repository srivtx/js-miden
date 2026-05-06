# CONCEPTS: Circuit Breaker

## Concept 1: State Machine

### WHAT

A state machine is a mathematical model of computation where an entity can be in exactly one of a finite number of states at any given time.

### WHY

Circuit breakers need unambiguous states. A request cannot be "kind of open" or "mostly closed." The state machine guarantees clear, testable behavior.

### HOW

```typescript
type CircuitState = 'closed' | 'open' | 'half-open';

// State transitions are triggered by events:
// CLOSED --[5 failures]--> OPEN
// OPEN --[30s elapsed]--> HALF-OPEN
// HALF-OPEN --[success]--> CLOSED
// HALF-OPEN --[failure]--> OPEN
```

### WRONG vs RIGHT

**WRONG: String comparison without types**
```typescript
if (state === 'oppen') { // typo, no compiler error
  // ...
}
```

**RIGHT: Union type + exhaustive checks**
```typescript
type CircuitState = 'closed' | 'open' | 'half-open';

function handleState(state: CircuitState): void {
  switch (state) {
    case 'closed': /* ... */ break;
    case 'open': /* ... */ break;
    case 'half-open': /* ... */ break;
    default:
      const _exhaustive: never = state; // Compile-time safety
  }
}
```

---

## Concept 2: Rolling Time Window

### WHAT

A rolling (or sliding) time window counts events that occurred within the last N milliseconds, continuously updating as time progresses.

### WHY

A fixed window (e.g., "failures in the current minute") creates boundary problems. 5 failures at 11:59:59 and 5 at 12:00:01 would not trigger in fixed windows but would in a rolling window.

### HOW

```typescript
interface FailureRecord {
  timestamp: number;
}

private failures: FailureRecord[] = [];

private onFailure(): void {
  this.failures.push({ timestamp: Date.now() });
  this.cleanupOldFailures();
}

private cleanupOldFailures(): void {
  const cutoff = Date.now() - this.options.failureWindowMs;
  this.failures = this.failures.filter(f => f.timestamp > cutoff);
}
```

### WRONG vs RIGHT

**WRONG: Fixed counter without timestamps**
```typescript
private failureCount = 0;

// Resets only on success or manual reset
// Cannot distinguish between "5 failures in 1 second" vs "5 failures in 1 hour"
```

**RIGHT: Timestamped records with periodic cleanup**
```typescript
private failures: FailureRecord[] = [];

// Accurate rolling window
// Can answer: "How many failures in the last 60s?"
// Memory bounded by cleanup
```

---

## Concept 3: Fail Fast

### WHAT

Fail fast means detecting a failure condition immediately and returning an error, rather than waiting for a timeout or retrying.

### WHY

In distributed systems, waiting is expensive. A 30-second timeout consumes a connection, memory, and a thread/event-loop tick. Returning a 503 in 1ms preserves all those resources.

### HOW

```typescript
async execute<T>(fn: () => Promise<T>): Promise<T> {
  this.checkTransition();

  if (this.state === 'open') {
    const error = new Error('Circuit breaker is OPEN');
    (error as any).statusCode = 503;
    throw error; // Fails in < 1ms
  }
  // ... proceed with actual call
}
```

### WRONG vs RIGHT

**WRONG: Timeout without breaker**
```typescript
// User waits 30 seconds, then gets 504 Gateway Timeout
// Meanwhile, 1000 other users are also waiting
```

**RIGHT: Immediate rejection**
```typescript
// User gets 503 in 1ms
// System resources preserved
// Downstream service not overwhelmed
```

---

## Concept 4: Half-Open Probing

### WHAT

Half-open is a probationary state where ONE test request is allowed through to verify if the downstream service has recovered.

### WHY

Without half-open, how do you know when to close the circuit? You could use a fixed timer ("wait 30s, then close"), but the service might still be down. Half-open is a safe probe.

### HOW

```typescript
if (this.state === 'half-open' && this.halfOpenAttempts >= 1) {
  throw new Error('Circuit breaker is OPEN');
}

if (this.state === 'half-open') {
  this.halfOpenAttempts++;
}

// On success:
private onSuccess(): void {
  if (this.state === 'half-open') {
    this.state = 'closed';  // Service is healthy again
    this.failures = [];     // Reset failure history
  }
}
```

### WRONG vs RIGHT

**WRONG: Close circuit after fixed time without probing**
```typescript
// After 30s, just set state = 'closed'
// If service is still down, we immediately get 5 more failures
// Circuit flaps: open -> closed -> open -> closed
```

**RIGHT: Single probe in half-open**
```typescript
// One request tests the waters
// Success = service is healthy
// Failure = stay open, wait another 30s
// No thundering herd on recovery
```
