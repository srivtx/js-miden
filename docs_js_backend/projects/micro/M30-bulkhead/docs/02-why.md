# WHY: Bulkhead Pattern

## Why Use the Bulkhead Pattern?

### 1. Failure Isolation
In a monolithic pool, one slow or failing workload can consume all resources, causing the entire system to collapse. Bulkheads prevent this by capping the resources any single workload can consume.

### 2. Priority Preservation
Critical user-facing requests (e.g., login, checkout) must succeed even when background tasks (e.g., report generation, data cleanup) are struggling. Separate pools ensure critical work is not starved.

### 3. Predictable Behavior
With fixed pool sizes, you know exactly how many concurrent operations of each type the system supports. This makes capacity planning and load testing much easier.

### 4. Graceful Degradation
When a pool is full, the system can return a 503 Service Unavailable immediately. This is better than queueing indefinitely, which causes cascading timeouts upstream.

## Real-World Analogy

A ship's hull is divided into watertight compartments (bulkheads). If one compartment floods, the others remain dry, and the ship stays afloat. Without bulkheads, a single leak sinks the entire vessel.

## Why Separate Pools Matter

A shared pool defeats the purpose. If background jobs can exhaust the same resource pool that serves user requests, a surge in background work will directly impact user experience. True isolation means each pool has its own independent limit.
