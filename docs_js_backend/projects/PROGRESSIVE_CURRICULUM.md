# Progressive Backend Project Curriculum

> **Quantity + Progression = Muscle Memory.** Start with 1-hour projects. End with systems that could run a startup.

---

## Philosophy

- **Micro Projects** (30 min - 1 hour): Single concept, single endpoint
- **Small Projects** (2-4 hours): 2-3 concepts combined
- **Medium Projects** (1-2 days): Full feature set, real-world scenario
- **Advanced Projects** (3-5 days): Complex systems, multiple services
- **Expert Projects** (1-2 weeks): Production-grade, could be a startup

**Rule:** Every project has at least **1 intentional bug** you must find and fix.
**Rule:** Every project includes **load testing** to prove it works under pressure.
**Rule:** Every project explains **WHY** and **WHAT IF WRONG**.

---

## Tier 1: Micro Projects (30 min - 1 hour each)

**Goal:** Build muscle memory on individual concepts. No project has more than 2 endpoints.

| # | Project | Concepts | New Thing |
|---|---------|----------|-----------|
| M01 | **Hello API with Logging** | Express, middleware | Pino structured logging |
| M02 | **JSON Validator Endpoint** | Zod, validation | Runtime type safety |
| M03 | **Health Check with DB** | PostgreSQL, connection | Deep health checks |
| M04 | **Counter API (Redis)** | Redis, atomic operations | Race condition prevention |
| M05 | **Rate Limiter** | Sliding window, Redis | Token bucket algorithm |
| M06 | **File Uploader (Local)** | Multer, streams | Memory vs disk storage |
| M07 | **JWT Generator/Verifier** | JWT, crypto | Token structure, expiry |
| M08 | **Password Hasher API** | bcrypt/argon2 | Timing-safe comparison |
| M09 | **Query Param Parser** | URL parsing, validation | Injection prevention |
| M10 | **CORS Tester** | CORS headers, preflight | Security implications |
| M11 | **Error Handler** | Express error middleware | RFC 7807 Problem Details |
| M12 | **Request Logger** | Morgan/Pino, async logging | Non-blocking I/O |
| M13 | **Simple Cache** | In-memory LRU | Cache invalidation |
| M14 | **UUID Generator** | crypto.randomUUID | Collision probability |
| M15 | **Ping API with Latency** | Response timing | Performance monitoring |

---

## Tier 2: Small Projects (2-4 hours each)

**Goal:** Combine 2-3 micro concepts into something useful.

| # | Project | Concepts Combined | Domain |
|---|---------|-------------------|--------|
| S01 | **Todo API (Full CRUD)** | CRUD, validation, error handling | Productivity |
| S02 | **Contact Form Backend** | Validation, email sending (simulated), rate limiting | Marketing |
| S03 | **Weather Cache API** | External API, Redis caching, TTL | Data aggregation |
| S04 | **Image Resizer** | File upload, sharp/libvips, streams | Media processing |
| S05 | **URL Shortener (Basic)** | Hashing, PostgreSQL, redirects | Link management |
| S06 | **Simple Auth System** | Register, login, JWT, password hashing | Security |
| S07 | **Note Taking API** | CRUD, search (ILIKE), pagination | Productivity |
| S08 | **CSV Processor** | File upload, streams, PapaParse | Data processing |
| S09 | **Real-time Chat (2 rooms)** | WebSockets, Socket.io basics | Communication |
| S10 | **Simple Blog API** | Posts, comments, relations, soft delete | Content |
| S11 | **Job Board API** | CRUD, filtering, sorting, pagination | Marketplace |
| S12 | **Polling API** | Create poll, vote, real-time results | Engagement |
| S13 | **Webhook Tester** | Receive webhooks, verify signatures, queue | Integrations |
| S14 | **File Sharing API** | Upload, download, expiry links, auth | File management |
| S15 | **Notification Service** | In-app notifications, unread counts, mark read | Communication |

---

## Tier 3: Medium Projects (1-2 days each)

**Goal:** Build real-world features that could ship to production.

| # | Project | What You Build | Key Challenge |
|---|---------|---------------|---------------|
| MD01 | **E-Commerce Cart** | Cart, checkout, inventory, orders | Race conditions in inventory |
| MD02 | **Booking System** | Availability calendar, overlapping bookings, payments | Concurrent slot reservation |
| MD03 | **URL Shortener (Production)** | Analytics, custom domains, geolocation, rate limits | Cache stampede, collision |
| MD04 | **Secure File Vault** | Encryption, streaming, signed URLs, audit logs | Memory management, security |
| MD05 | **Collaborative Whiteboard** | CRDTs, real-time sync, presence | Conflict resolution |
| MD06 | **SaaS Billing Engine** | Stripe webhooks, idempotency, state machines | Double-charge prevention |
| MD07 | **AI Content Studio** | LLM streaming, embeddings, vector search | Token cost management |
| MD08 | **Distributed Job Queue** | BullMQ, retries, DLQ, progress tracking | Worker reliability |
| MD09 | **Social Feed Engine** | Fan-out, ranking, cursor pagination | Celebrity problem |
| MD10 | **Multi-tenant Gateway** | Tenant isolation, RLS, API versioning | Cross-tenant data leaks |
| MD11 | **Video Transcoding Service** | Upload, queue, transcode, notify | Background job reliability |
| MD12 | **Analytics Pipeline** | Event ingestion, aggregation, dashboards | Time-series data |

---

## Tier 4: Advanced Projects (3-5 days each)

**Goal:** Multi-service systems with real complexity.

| # | Project | Architecture | What Makes It Hard |
|---|---------|------------|-------------------|
| A01 | **Real-Time Auction System** | WebSockets + Redis + PostgreSQL | Bidding race conditions, last-millisecond bids |
| A02 | **Distributed Message Queue** | Custom queue, workers, DLQ, monitoring | At-least-once delivery, ordering |
| A03 | **Search Engine Backend** | Elasticsearch/Meilisearch + API + indexing | Relevance tuning, index management |
| A04 | **Payment Orchestrator** | Multiple providers (Stripe + PayPal), routing, failover | Idempotency across providers |
| A05 | **IoT Device Manager** | MQTT/WebSockets, device registry, telemetry | High throughput, device authentication |
| A06 | **Content Moderation Pipeline** | AI moderation, human review queue, appeals | Accuracy vs speed, edge cases |
| A07 | **Geo-Distributed API** | Multi-region deployment, data locality, CDN | Latency, consistency |
| A08 | **Financial Ledger** | Double-entry bookkeeping, reconciliation, audit | Immutable records, correctness |
| A09 | **Code Execution Sandbox** | Docker isolation, resource limits, stdout capture | Security (no escape), timeouts |
| A10 | **Recommendation Engine** | Collaborative filtering, real-time scoring, A/B test | Cold start, diversity, performance |

---

## Tier 5: Expert Projects (1-2 weeks each)

**Goal:** These could be VC-backed startups.

| # | Project | What It Is | Why It's Expert-Level |
|---|---------|-----------|----------------------|
| E01 | **TeamTask Pro** | Multi-tenant SaaS project management | Full auth, RBAC, real-time, file uploads, billing |
| E02 | **StreamForge** | Live streaming platform backend | RTMP ingestion, HLS transcoding, chat, monetization |
| E03 | **CloudQuery** | Database-as-a-Service API | Connection pooling, query optimization, tenant isolation |
| E04 | **DataSync** | Real-time data synchronization engine | CRDTs, conflict resolution, offline-first, sync protocol |
| E05 | **ApiHub** | API marketplace with monetization | Developer portal, usage tracking, billing, rate limits |
| E06 | **HealthBridge** | Healthcare data interoperability | HIPAA compliance, FHIR standard, audit trails, encryption |

---

## Progression Path

### Path A: The Complete Journey (4-6 months part-time)
```
All Micro (15) → All Small (15) → All Medium (12) → 5 Advanced → 2 Expert
```

### Path B: The Job-Ready Sprint (2 months full-time)
```
Micro M01-M05 → Small S01-S05 → Medium MD01, MD03, MD04, MD06 → Advanced A01, A04
```

### Path C: The Specialist (3 months)
```
Pick a domain (e.g., Fintech):
Micro M04, M07, M08 → Small S06, S13 → Medium MD02, MD06, MD10 → Advanced A04, A08 → Expert E01
```

---

## Project Structure (Every Project)

```
project-XX-name/
├── README.md              # Full guide (WHAT, WHY, BUGS)
├── CRITIQUE.md            # Critic review (read before building)
├── src/
│   ├── index.ts           # Entry point
│   ├── routes/            # Route handlers
│   ├── middleware/        # Auth, validation, error handling
│   ├── services/          # Business logic
│   └── db/                # Prisma/client
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # API tests
│   └── load/              # k6 scripts
├── bugs/
│   ├── bug-01/            # Each bug has description + test
│   ├── bug-02/
│   └── bug-03/
├── docker-compose.yml     # PostgreSQL + Redis + app
├── Dockerfile
├── package.json
└── .env.example
```

---

## How to Use

1. **Pick your tier** based on current skill
2. **Read the README** (15 min)
3. **Read CRITIQUE.md** (10 min) — know the dangers
4. **Run tests** — they fail (because bugs exist)
5. **Build the project** following the guide
6. **Find and fix each bug** — tests turn green
7. **Run load tests** — prove it scales
8. **Write post-mortem** — what did you learn?
9. **Move to next project**

---

## Success Metrics

After completing:
- **15 Micro projects**: You can build any single backend concept in under an hour
- **+15 Small projects**: You can combine concepts fluently
- **+12 Medium projects**: You can build production-ready features
- **+5 Advanced projects**: You can design multi-service systems
- **+2 Expert projects**: You have a portfolio that gets you hired anywhere

**Total: 49 projects. That's muscle memory.**
