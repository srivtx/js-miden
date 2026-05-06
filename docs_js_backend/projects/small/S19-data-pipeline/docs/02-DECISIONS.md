# 02-DECISIONS.md

## Key Design Decisions

### Decision 1: ETL vs ELT

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **ETL (Transform before Load)** | Clean data in warehouse, smaller storage | Complex transform logic, harder to debug | ✅ **CHOSEN** — Classic pattern, easier to reason about |
| ELT (Load raw, transform in DB) | Faster ingestion, leverages DB power | Warehouse stores dirty data, higher cost | ❌ Good but requires powerful warehouse |
| EtLT (Extract, light Transform, Load, then Transform) | Balance of both | More complex architecture | ❌ Advanced pattern |

**Rationale**: ETL is the foundational pattern. Understanding extract, transform, and load as distinct phases makes debugging and monitoring easier.

### Decision 2: Batch vs Streaming

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **Batch (this project)** | Simple, replayable, cost-effective | Data latency | ✅ **CHOSEN** — Fundamentals first |
| Streaming (Kafka/Kinesis) | Real-time, event-driven | Complex, expensive, ordering challenges | ❌ Good but adds infrastructure complexity |
| Micro-batch (Spark) | Near real-time, scalable | Requires cluster | ❌ Overkill for small pipeline |

**Rationale**: Batch processing teaches the core concepts (idempotency, error isolation, schema evolution) without distributed systems overhead.

### Decision 3: Error Handling Strategy

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **Per-row try/catch** | Isolates bad data, loads good data | Slightly slower | ✅ **CHOSEN** — Production requirement |
| All-or-nothing transaction | Data consistency guaranteed | One bad row fails everything | ❌ Unacceptable for real data |
| Skip silently | Fastest | Silent data loss | ❌ Dangerous |

**Rationale**: Real data is dirty. A pipeline that fails on the first bad row is unusable in production.

### Decision 4: Idempotency Mechanism

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **UPSERT on primary key** | Simple, widely supported | Requires unique key | ✅ **CHOSEN** — Standard approach |
| Delete + Insert | Guaranteed no duplicates | Downtime, lost history | ❌ Risky |
| Track processed files | Zero DB overhead | State management complexity | ❌ Good but less robust |
| MERGE statement | SQL standard | DB-specific syntax | ❌ Good alternative |

**Rationale**: UPSERT (`INSERT ... ON CONFLICT ... DO UPDATE`) is supported by PostgreSQL, SQLite, MySQL, and most warehouses. It's the most portable idempotency strategy.

### Decision 5: Orchestration

| Alternative | Pros | Cons | Decision |
|------------|------|------|----------|
| **HTTP trigger (this project)** | Simple, easy to test | Not automated | ✅ **CHOSEN** — Manual trigger for learning |
| Cron / Scheduled | Automated, simple | No dependency management | ❌ Good but basic |
| Airflow / Dagster | Dependency graphs, retries, UI | Complex setup | ❌ Industry standard but too heavy |
| AWS Glue / GCP Dataflow | Managed, scalable | Vendor lock-in, cost | ❌ Cloud-specific |

**Rationale**: An HTTP endpoint keeps the project self-contained. In production, you'd replace this with a scheduler or workflow engine.
