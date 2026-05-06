# A11 Trading Engine: Design Thinking

## Constraints & Forces

### 1. Correctness vs Speed
A buggy fast engine is worse than a slow correct one. Knight Capital lost $440M in 45 minutes due to a software bug. However, a correct engine that takes 100ms per match is commercially unusable.

**Resolution**: Optimize the hot path (matching loop) for speed, but surround it with defensive validation and atomic database operations.

### 2. Memory vs Database
Orders can live in memory (Redis, in-process array) or on disk (PostgreSQL). In-memory is 1000x faster but loses data on crash. Disk is durable but slow.

**Resolution**: Hybrid approach. Active book in memory, write-ahead log to disk. On crash, replay the log to rebuild state.

### 3. Single-Threaded vs Multi-Threaded
Single-threaded eliminates race conditions but caps throughput. Multi-threaded scales horizontally but introduces the exact bugs this project demonstrates.

**Resolution**: Shard by symbol. Each symbol runs on a dedicated thread/process. No shared mutable state across symbols.

## Mental Models

### The Order Book as a Priority Queue
```
BIDS (Buy Side)                    ASKS (Sell Side)
===========                        =============
Price    Qty    Time               Price    Qty    Time
$150.10  500    09:30:01.001       $150.15  200    09:30:00.500
$150.05  300    09:30:01.100       $150.20  400    09:30:00.600
$150.00  1000   09:30:01.200       $150.25  100    09:30:00.700
```

The "spread" is the gap between best bid ($150.10) and best ask ($150.15). A market buy at $150.15 would match the 200 units, then move to $150.20.

### The Matching Loop as State Machine
Each order transitions through states:
```
OPEN → PARTIALLY_FILLED → FILLED
  ↓
CANCELLED
```

State transitions must be atomic. Two matchers cannot transition the same order to FILLED independently.

### Price-Time Priority as Fairness
If two orders are at the same price, the one that arrived first gets filled first. This is equivalent to FIFO queueing. Any deviation (e.g., randomizing, or favoring larger orders) creates perverse incentives and regulatory scrutiny.

## Risk Scenarios

1. **Over-fill**: Two market orders match the same resting limit order. Total filled exceeds quantity. The exchange now owes shares it doesn't have.
2. **Under-fill**: A resting order is partially filled by one matcher, but the second matcher sees stale state and thinks it's filled. The incoming order remains unfilled when it should have traded.
3. **Negative prices**: A buy order at -$5.00 would match any sell order (since -5 < any positive price), draining the book and creating infinite money.

## Trade-Off Analysis

| Approach | Pros | Cons |
|----------|------|------|
| In-memory book + WAL | Fast, recoverable | Complex recovery, memory limits |
| Pure database (PostgreSQL) | ACID, simple | 10-100x slower, connection pool exhaustion |
| Redis sorted sets | Fast, shared across nodes | No atomic multi-key transactions, Lua scripting required |
| LMAX Disruptor pattern | Lock-free, 1M+ TPS | Complex, Java-specific, hard to reason about |
| Actor model (per symbol) | Natural isolation | Message passing overhead, harder to debug |
