# A11 Trading Engine: Architecture Decisions

## Decision 1: Price-Time Priority Sorting

**Chosen**: Sort bids descending by price, then ascending by time. Sort asks ascending by price, then ascending by time.

**Alternatives Considered**:
- **Pro-rata matching** (CME): Orders at the same price are filled proportionally by size. Used for futures. Pro: encourages liquidity. Con: complex, queue-jumping via large orders.
- **Price-size priority**: Larger orders at same price get filled first. Con: disadvantages retail traders.
- **Randomized priority**: Break ties randomly. Con: non-deterministic, hard to test, regulatory issues.

**Rationale**: Price-time is the global standard for equities (NYSE, NASDAQ, LSE). It's simple, fair, and regulators understand it.

## Decision 2: Synchronous Matching with Async Persistence

**Chosen**: Match synchronously in the request handler, then async write to database.

**Alternatives Considered**:
- **Fully async (message queue)**: Orders go to Kafka, consumers match. Pro: decouples, scales. Con: adds 10-50ms latency, harder to guarantee FIFO.
- **Synchronous database matching**: Use `SELECT ... FOR UPDATE`. Pro: ACID. Con: database becomes bottleneck.
- **Event-sourced matching**: Every order is an event; state is derived. Pro: audit trail, replay. Con: complexity, snapshot management.

**Rationale**: For a startup or mid-size exchange, synchronous matching with optimistic locking provides the best balance of correctness and latency.

## Decision 3: In-Memory Data Structures

**Chosen**: Plain JavaScript arrays sorted per request.

**Alternatives Considered**:
- **Red-Black Tree**: O(log n) insertion. Con: complex implementation, no native JS support.
- **Skip List**: O(log n) average, simpler than tree. Con: probabilistic, not native.
- **Heap/Priority Queue**: O(log n) insertion. Con: doesn't support efficient removal of arbitrary elements (needed for cancellations).
- **Map + Sorted Index**: Maintain a Map for O(1) lookup and a sorted array for iteration.

**Rationale**: For order books under 10,000 orders per symbol, `Array.sort()` on insertion is fast enough and infinitely simpler. Premature optimization is the root of all evil.

## Decision 4: Database Choice (Mock)

**Chosen**: In-memory Map with simulated async latency.

**Alternatives Considered**:
- **PostgreSQL**: Use `UPDATE ... WHERE filled_quantity + ? <= quantity`. Pro: ACID. Con: 2-5ms latency per query.
- **Redis**: Lua script for atomic compare-and-swap. Pro: sub-millisecond. Con: Lua debugging, single-threaded per node.
- **FoundationDB**: Google's distributed KV with ACID. Pro: scales horizontally. Con: operational complexity.

**Rationale**: This is a teaching project. The in-memory Map makes the race condition reproducible. In production, PostgreSQL with row-level locking or Redis with Lua is the correct choice.

## Decision 5: No Order Validation in Routes

**This was a deliberate (bad) choice in the original code.**

**Correct approach**: Validate price > 0, quantity > 0, symbol exists, and user has sufficient balance before accepting the order.

**Why the original skipped it**: Likely to "keep the demo simple." This is a catastrophic simplification.
