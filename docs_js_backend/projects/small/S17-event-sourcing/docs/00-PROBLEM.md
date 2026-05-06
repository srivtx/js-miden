# 00-PROBLEM.md

## WHAT Problem Does Event Sourcing Solve?

Traditional CRUD applications directly mutate database rows. When a user's bank balance changes from $100 to $150, the old value is overwritten and lost forever. There is no audit trail, no way to reconstruct history, and no ability to answer questions like "What was the balance on March 15th?" or "Who authorized this withdrawal?"

**The Core Problem**: Mutable state destroys information

```
CRUD Data Loss:

Time 09:00  User deposits $100   -> DB: balance = 100
Time 10:30  User withdraws $50   -> DB: balance = 50  (100 is GONE)
Time 14:00  User disputes 10:30  -> Can't prove what happened!

Result: Audit = NULL. Forensics = impossible.
```

## WHY This Matters

- **Regulatory Compliance**: GDPR, SOX, PCI-DSS require audit trails
- **Bug Recovery**: When a bug corrupts state, you need history to rebuild correctly
- **Business Intelligence**: Temporal queries ("How many deposits on Tuesdays?") need raw events
- **Debugging**: Replaying a user's event stream locally reproduces their exact state
- **CQRS**: Separating read and write models is trivial when the write model is just an append-only log

## HOW Event Sourcing Addresses It

Instead of storing state, store the events that LED to the state.

```
Event Sourcing Preserves Everything:

Time 09:00  AccountCreated    { owner: "Alice", initialBalance: 0 }
Time 09:15  MoneyDeposited    { amount: 100 }
Time 10:30  MoneyWithdrawn    { amount: 50 }
Time 14:00  MoneyDeposited    { amount: 25 }

Current State (recomputed): balance = 75
State at 10:00 (recomputed): balance = 100
State at any time: replay events up to that point
```

The event store is append-only and immutable. Events are facts.

But Event Sourcing introduces NEW problems:
1. **Direct State Update Bug**: Developers habitually mutate state, defeating the entire pattern
2. **No Snapshotting**: Replaying 1 million events on every read is O(n) and unusably slow
3. **Schema Evolution**: Old events may have different shapes than current code expects
4. **Eventual Consistency**: Read models lag behind the event store

## WRONG vs RIGHT

| Aspect | WRONG (CRUD in ES clothing) | RIGHT (True Event Sourcing) |
|--------|----------------------------|----------------------------|
| Writes | `UPDATE accounts SET balance = 150` | `INSERT events (type='MoneyDeposited', ...)` |
| Reads | `SELECT balance FROM accounts` | `replay(events)` or `SELECT snapshot + recent events` |
| State | Mutable row in DB | Derived from immutable event log |
| History | Lost on every write | Complete, forever |

## Real-World Impact

- **Greg Young (2010)**: Coined CQRS+Event Sourcing pattern; used in high-frequency trading where every tick must be preserved
- **EventStoreDB**: Purpose-built database for event sourcing, used by Volvo, KLM, and government systems
- **Martin Fowler (2005)**: "Event Sourcing" pattern in PoEAA established the architectural foundation
