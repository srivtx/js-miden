# THINKING: Circuit Breaker

## Mental Models

### The Electrical Circuit Breaker Analogy

Think of your home's electrical panel. When too much current flows, the breaker trips (open state). You don't keep sending electricity through a short circuit; you stop, investigate, and carefully test (half-open). Only when safe do you reset (closed). Software circuit breakers follow the exact same logic.

### The Pressure Valve Model

A circuit breaker is a pressure valve for your system. When downstream pressure builds (failures), the valve opens to prevent the pipe from bursting (cascading failure). It doesn't fix the downstream problem; it protects everything upstream.

### The Doctor's Waiting Room

Imagine a doctor's office where patients keep arriving but the doctor is unconscious. Without a circuit breaker, the waiting room fills indefinitely (memory exhaustion). With a circuit breaker, the receptionist tells new patients to come back later (fail fast), preserving the waiting room for when the doctor recovers.

## Hot Path (What Happens on Every Request)

```
Request Arrives
    |
    v
[Check State] --open?--> [Return 503] --> Done (0.1ms)
    |
 closed / half-open
    |
    v
[Check Half-Open Limits] --too many?--> [Return 503] --> Done
    |
    v
[Execute with Timeout] --success?--> [Clear/Keep State] --> Done
    |
    v
[Record Failure] --threshold reached?--> [Open Circuit] --> Done
```

The hot path must be O(1) for success cases. Failure tracking is O(n) where n = failures in window, but cleanup keeps n bounded.

## Danger Zones

### 1. Race Condition in State Transition

Two requests arrive simultaneously when the circuit is about to transition from open to half-open. Both could pass through, overwhelming a recovering service.

**Mitigation**: Atomic state checks and half-open attempt counters.

### 2. Failure Window Memory Leak

Without cleanup, failures array grows unbounded if a service fails continuously for hours.

**Mitigation**: Filter old failures on every failure record.

### 3. Timeout Longer Than Half-Open Timeout

If request timeout (5s) >= halfOpenTimeoutMs (30s), the math works. But if someone configures timeoutMs: 60000 and halfOpenTimeoutMs: 5000, requests hang longer than the recovery probe interval.

**Mitigation**: Validate configuration at startup. timeoutMs must be < halfOpenTimeoutMs.

### 4. False Positives from Network Blips

A brief network blip causes 5 failures in 10 seconds, opening the circuit for 30 seconds unnecessarily.

**Mitigation**: Require higher thresholds or use success-rate-based breakers (e.g., open if failure rate > 50% over 100 requests).

## What-If Game

### What if the circuit never opens?

Every request hits the failing service. Response times degrade to timeout duration. Threads/memory exhaust. System crashes. **This is our intentional bug.**

### What if the circuit opens too aggressively?

Threshold = 1 failure, window = 1ms. Circuit flaps constantly. Users see intermittent 503s. Monitoring becomes noisy. Trust in the system degrades.

### What if the half-open timeout is too short?

Circuit probes a recovering service every 1 second. The service gets 1 request/second while still recovering. It might fail, re-open, wait 1s, try again. The service never gets enough quiet time to fully recover.

### What if the half-open timeout is too long?

Service recovers in 5 seconds but circuit stays open for 5 minutes. Users see 503s for 4m55s longer than necessary. Revenue lost.

### What if we have 1000 microservices, each with breakers?

Every service pair needs a breaker. Configuration explosion. Monitoring complexity. We need a service mesh (Istio, Linkerd) to handle this at the infrastructure layer.

### What if the breaker itself crashes?

State is in memory. Restart = closed state. Brief window of vulnerability until failures accumulate again. Consider external state stores (Redis) for critical breakers.
