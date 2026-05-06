# 08-CRITIQUE.md

## Critical Analysis

### What This Project Does Well

1. **Clear Event Model**: `AccountCreated`, `MoneyDeposited`, `MoneyWithdrawn` are crisp, past-tense domain events.
2. **Two Distinct Bugs**: Direct state update and missing snapshots are the most common ES footguns.
3. **Replay Function Exists**: The `rebuildState()` function is already implemented, making the fix obvious.

### What This Project Lacks

1. **No Event Bus / Projections**: Real event sourcing publishes events to a bus so read models can update asynchronously. This project has no mechanism for other services to react to events.

2. **No Compensating Events**: The withdrawal logic returns `{ error: 'Insufficient funds' }` but doesn't append an event. In true ES, even failures can be events (`WithdrawalDeclined`) for audit purposes.

3. **Single Aggregate Only**: A real system has many aggregate types (`Account`, `Transfer`, `Loan`). Cross-aggregate communication (sagas) is a key ES challenge missing here.

4. **No Event Schema Registry**: Events are `Record<string, unknown>`. In production, you'd use Zod, JSON Schema, or Protobuf to validate and version payloads.

5. **No Temporal Querying**: The event log has timestamps but no API endpoint to query "What was the balance at time T?"

6. **Missing Idempotency**: Replaying a deposit command twice appends two events. Production systems need idempotency keys.

### Architecture Critique

```
Current (Monolithic):
┌──────────────────────────────┐
│  Express + Event Store Array │
│  + Mutable Cache Map         │
└──────────────────────────────┘

Better (Command/Query Separation):
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Command    │────>│ Event Store  │────>│  Projection  │
│   API        │     │ (Append-Only)│     │  Workers     │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                           ┌──────▼──────┐
                                           │ Read Models │
                                           │  (PostgreSQL)│
                                           └─────────────┘
```

### Testing Gaps

- No concurrent command tests (optimistic concurrency)
- No snapshot corruption tests (delete snapshot, verify rebuild works)
- No event schema migration tests (old events with new code)
- No performance tests showing replay time vs event count

### The Immutable Lie

Event sourcing promises immutability, but in practice:
- GDPR "right to erasure" requires deleting personal data from events
- Some teams implement "tombstone events" or encrypted payloads
- Others use "crypto-shredding" (delete the key, data becomes unreadable)

This project doesn't address the tension between immutability and regulations.

### The Learning Curve Problem

Event sourcing is SIMPLE in concept but HARD in practice:
- Developers habitually think in state, not events
- Debugging requires reading event streams, not inspecting tables
- Testing requires event sequences, not state assertions

This project is a good start, but students need exposure to:
- EventStoreDB or PostgreSQL persistence
- Async projections and eventual consistency
- Event versioning and upcasters
- Distributed sagas and process managers

Without these, they may implement "event sourcing" that is just CRUD with extra steps.
