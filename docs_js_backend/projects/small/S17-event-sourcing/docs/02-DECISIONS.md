# 02-DECISIONS.md

## Key Design Decisions

### Decision 1: In-Memory Event Store vs EventStoreDB

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **In-Memory Array** | Zero setup, instant for teaching | Volatile, no persistence, no concurrency | ✅ **CHOSEN** — Focus on pattern, not ops |
| EventStoreDB | Production-grade, subscriptions, projections | Requires server, complex to set up | ❌ Too heavy for fundamentals |
| PostgreSQL (events table) | Familiar, persistent, transactional | Schema design needed, no stream semantics | ❌ Good but adds SQL complexity |
| Kafka | Distributed, durable, replayable | Overkill, not an event store (it's a log) | ❌ Different abstraction |

**Rationale**: Event sourcing concepts (append-only, replay, snapshots) are independent of storage technology. An array teaches the pattern without Docker complexity.

### Decision 2: Optimistic Concurrency Control

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **Event Versioning** | Simple, works in-memory | Requires transaction boundary in real DB | ✅ **CHOSEN** — Core ES concept |
| UUID per event | Globally unique, no coordination | No ordering guarantee | ❌ Event order matters |
| Vector clocks | Distributed systems | Complex, overkill for single-node | ❌ Not needed here |

**Rationale**: Each event has a `version` that increments per aggregate. Appending an event checks that the expected version matches, preventing lost updates.

### Decision 3: Snapshot Strategy

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **Version-based (every N events)** | Predictable, simple | N must be tuned | ✅ **CHOSEN** — Easiest to understand |
| Time-based (every N minutes) | Handles bursty traffic | May snapshot too often or too rarely | ❌ Less intuitive |
| On-read (if events > threshold) | Adaptive | Read latency spikes on first access | ❌ Unpredictable |

**Rationale**: "Snapshot every 100 events" is the textbook approach. Students can reason about it immediately.

### Decision 4: CQRS Separation

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **Combined (this project)** | Simple, one codebase | Read model not optimized | ✅ **CHOSEN** — Basics first |
| Separate read/write models | Optimized queries, scalability | Complexity, eventual consistency |  architectural pattern, not beginner material |
| Projections to Elasticsearch | Full-text search on events | Infrastructure overhead | ❌ Advanced |

**Rationale**: True CQRS requires multiple data stores and message buses. This project keeps commands and reads in the same process to focus on the event log itself.

### Decision 5: Event Schema

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **Flat payload (Record<string, unknown>)** | Flexible, easy to store | No type safety | ✅ **CHOSEN** — Matches real ES where payloads evolve |
| Strongly typed unions | Type-safe at compile time | Rigid, harder to version | ❌ Good but less realistic |
| JSON Schema validated | Runtime validation | Another layer to learn | ❌ Overkill for small project |

**Rationale**: Real event stores use JSON payloads. The `Record<string, unknown>` type reflects production reality where events evolve over years.
