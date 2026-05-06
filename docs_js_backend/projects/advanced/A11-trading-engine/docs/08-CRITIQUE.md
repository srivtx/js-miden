# A11 Trading Engine: Critique

## What This Project Does Well

1. **Demonstrates real bugs**: The race condition and negative price bugs are not contrived. They are simplified versions of bugs that have cost billions.
2. **Teaches atomicity**: The contrast between read-modify-write and compare-and-swap is clear and practical.
3. **Tests concurrency**: The test suite uses `Promise.all` to simulate concurrent orders, which is exactly how real load testing works.

## What This Project Gets Wrong

### 1. In-Memory Database
Using a JavaScript Map for orders and trades is a teaching convenience, not a design choice. In production:
- Data would be lost on process crash
- No replication or backup
- Cannot query historical data
- Single-node only

**Better**: PostgreSQL with connection pooling, or Redis with persistence.

### 2. No Pre-Trade Risk Checks
A real engine would check:
- Does the user have sufficient balance?
- Is the order size within limits?
- Is the user suspended or banned?
- Does this order create a market manipulation pattern?

Without these, the engine is a toy.

### 3. No Market Data Feed
After a trade, the engine should publish:
- Trade execution to both parties
- Order book update (top of book change)
- Last traded price update

These feeds power charting, risk systems, and regulatory reporting.

### 4. Single Symbol Bottleneck
The current code sorts the entire book for every match. For a liquid symbol like AAPL with 100,000 orders, this is O(n log n) per match. A real engine would:
- Maintain sorted data structures (TreeMap, SkipList)
- Update only affected price levels
- Use level 2 order book (aggregated by price) for public display

### 5. No Settlement or Clearing
Matching is only step 1. After matching:
- Securities must be delivered (T+2 in equities, instant in crypto)
- Cash must settle
- Custodians must update ledgers
- Regulators must receive reports

This engine stops at "createTrade()."

### 6. Testing Is Insufficient
The concurrent test has a 50ms artificial delay to "exacerbate" the race condition. This is a hack. Real race condition testing requires:
- Property-based testing (e.g., fast-check) to generate random order sequences
- Formal verification for the matching algorithm
- Chaos engineering (randomly kill the process during matching)

### 7. TypeScript Is Too Permissive
The `price: number` type allows `NaN`, `Infinity`, and `-Infinity`. A production type would be:
```typescript
type PositiveFiniteNumber = number & { __brand: 'PositiveFinite' };
```
Or use a validation library like `io-ts` or `zod` that parses and refines types.

## What Would Make This Production-Ready

| Feature | Effort | Priority |
|---------|--------|----------|
| PostgreSQL with advisory locks | 2 days | Critical |
| Pre-trade risk checks | 3 days | Critical |
| WebSocket market data feed | 2 days | High |
| Order book snapshot API | 1 day | High |
| Admin/surveillance dashboard | 5 days | Medium |
| FIX protocol gateway | 5 days | Medium |
| Multi-symbol sharding | 3 days | High |
| Chaos testing | 2 days | Medium |

## Final Verdict

This is a **correctness-first educational prototype**. It successfully demonstrates why trading engines are hard. It does not claim to be production-ready, and it should not be used as such. The value is in the bugs: every developer who fixes the race condition and adds validation understands more about distributed systems than before.

**The real lesson**: In financial software, "simple" features (subtract two numbers, compare two prices) become terrifyingly complex under concurrency. Never trust a demo that hasn't been tested with `Promise.all`.
