# Backend Mastery Through Projects

> **The only way to learn backend engineering is to build things, break them, and fix them.** 53 projects. From 30-minute micro-projects to 2-week expert systems. Each with full docs, intentional bugs, and the thinking process behind every decision.

---

## 🎯 Philosophy

Each project follows the **Thinking Framework** (see `DOCUMENTATION_TEMPLATE.md`):

**Phase 1: Problem Understanding** - What, why, who, constraints  
**Phase 2: Thinking & Constraints** - Mental models, hot path, danger zones  
**Phase 3: Architecture Decisions** - Every choice with alternatives and trade-offs  
**Phase 4: Building** - Step-by-step from scratch  
**Phase 5: Breaking & Fixing** - Intentional bugs with real-world impact  

Every project has:
- ✅ Complete runnable code (Express 5, TypeScript, ESM)
- ✅ 9 docs files explaining WHAT, WHY, HOW, WRONG vs RIGHT
- ✅ 1-3 intentional bugs to find and fix
- ✅ Tests that fail until you fix the bugs
- ✅ Docker setup where needed
- ✅ Research-backed decisions with citations

---

## 📊 Progression Overview

| Tier | Count | Time Each | Total Time | Purpose |
|------|-------|-----------|------------|---------|
| **Micro** | 20 | 30-60 min | 15-20 hours | Muscle memory on single concepts |
| **Small** | 15 | 2-4 hours | 30-60 hours | Combining 2-3 concepts |
| **Medium** | 10 | 1-2 days | 2-4 weeks | Production-ready features |
| **Advanced** | 6 | 3-5 days | 3-5 weeks | Multi-service systems |
| **Expert** | 2 | 1-2 weeks | 2-4 weeks | Startup-grade systems |
| **TOTAL** | **53** | | **3-6 months** | **Complete backend mastery** |

---

## 🟢 Tier 1: Micro Projects (30-60 min each)

**Goal:** Build muscle memory on individual backend concepts.

| # | Project | What You Learn | The Bug |
|---|---------|----------------|---------|
| M01 | **Hello API with Logging** | Pino structured logging, middleware | Response timing captured once at startup |
| M02 | **JSON Validator** | Zod runtime validation, TypeScript types | `.passthrough()` allows mass assignment |
| M03 | **Health Check with DB** | Deep health checks, connection pooling | Doesn't await DB check (always returns 200) |
| M04 | **Counter API (Redis)** | Redis atomic operations, race conditions | Read-modify-write loses increments |
| M05 | **Rate Limiter** | Sliding window, Redis sorted sets, Lua | Fixed window allows burst at boundaries |
| M06 | **File Uploader** | Multer, streams vs buffers, multipart | `memoryStorage` buffers entire file in RAM |
| M07 | **JWT Auth** | JWT structure, claims, expiry, cookies | `ignoreExpiration: true` (tokens valid forever) |
| M08 | **Password Hasher** | bcrypt/Argon2, salts, timing attacks | SHA-256 without salt + `===` comparison |
| M09 | **Query Param Parser** | Type coercion, validation, XSS prevention | `"1" + 1 = "11"` string concatenation |
| M10 | **Simple Cache** | LRU, TTL, Map vs WeakMap, memory leaks | Orphaned setTimeout timers |
| M11 | **CORS Tester** | Preflight, origins, credentials, Vary header | `origin: '*'` with `credentials: true` |
| M12 | **Error Handler** | RFC 7807, headersSent, stack traces | Exposes stack traces + no headersSent check |
| M13 | **Request Logger** | Async logging, sensitive data redaction | Logs request body including passwords |
| M14 | **UUID Generator** | crypto.randomUUID, collision probability | `Math.random()` instead of CSPRNG |
| M15 | **Ping API** | DNS resolution, TCP handshake, latency | No SSRF protection (can ping internal IPs) |
| M16 | **Redirector** | 301 vs 302 vs 307, open redirects | Accepts `javascript:` URLs (phishing) |
| M17 | **CSV Parser** | Streaming parse, RFC 4180, formula injection | Loads entire file into memory |
| M18 | **Timezone API** | IANA database, DST, ISO 8601, Intl API | Returns local time instead of requested zone |
| M19 | **Header Inspector** | X-Forwarded-For, proxy headers, security headers | Trusts XFF blindly (IP spoofing) |
| M20 | **Webhook Receiver** | HMAC verification, replay attacks, idempotency | No signature verification (accepts forged) |

---

## 🟡 Tier 2: Small Projects (2-4 hours each)

**Goal:** Combine 2-3 micro concepts into useful features.

| # | Project | What You Build | Concepts Combined | The Bug |
|---|---------|---------------|-------------------|---------|
| S01 | **Todo API** | Full CRUD with search, pagination | CRUD, validation, soft delete | Race condition in update (lost update) |
| S02 | **Contact Form** | Form with validation, rate limiting | Validation, Redis rate limit, email | Rate limiter imported but not applied |
| S03 | **Weather Cache** | Cached weather with fallback | External API, cache-aside, TTL | Cache stampede (no mutex on refresh) |
| S04 | **Image Resizer** | Upload + resize + format conversion | File upload, Sharp, streams | Buffer-based processing (OOM) |
| S05 | **Note API** | Notes with full-text search | CRUD, PostgreSQL tsvector, pagination | SQL injection in search query |
| S06 | **Chat Rooms** | Real-time chat with Socket.io | WebSockets, rooms, broadcasting | Broadcasts globally instead of room |
| S07 | **Blog API** | Posts + comments + soft delete | 1:N relations, aggregates, soft delete | N+1 query (queries per post) |
| S08 | **Job Board** | Jobs with filtering and sorting | Range queries, filtering, data types | Float for money (rounding errors) |
| S09 | **Polling API** | Create poll, vote, real-time results | SSE, vote counting, deduplication | Race condition in vote count |
| S10 | **File Sharing** | Upload, share links, expiry | Signed URLs, token expiration, storage | Expiry not checked at download time |
| S11 | **Notification Service** | In-app notifications, unread counts | SSE, pagination, aggregation | Race condition in unread count |
| S12 | **URL Expander** | Follow redirects, detect loops | HTTP redirects, SSRF, timeouts | SSRF via redirects to internal IPs |
| S13 | **API Key Manager** | Generate, revoke, rate limit keys | Hashing, rate limiting, auth | Stores keys in plaintext |
| S14 | **Search API** | Full-text search with relevance | tsvector, stemming, highlighting | Uses ILIKE instead of full-text index |
| S15 | **Webhook Sender** | Send webhooks with retries | HTTP client, retry logic, signatures | No retry on failure (fire-and-forget) |

---

## 🟠 Tier 3: Medium Projects (1-2 days each)

**Goal:** Build production-ready features that could ship.

| # | Project | Domain | What You Build | The Bug |
|---|---------|--------|---------------|---------|
| MD01 | **E-Commerce Cart** | E-commerce | Cart, checkout, inventory, orders | Race condition: two users buy last item |
| MD02 | **Booking System** | Scheduling | Calendar, bookings, holds, cancellation | Overlapping bookings allowed |
| MD03 | **URL Shortener Pro** | Link management | Shortener + analytics + rate limiting | Cache stampede on popular URLs |
| MD04 | **Secure File Vault** | Security | Encrypted uploads, signed URLs, audit | Buffer entire file (OOM on 2GB) |
| MD05 | **Collaborative Whiteboard** | Real-time | Drawing sync, cursors, session replay | No conflict resolution (overwrites) |
| MD06 | **SaaS Billing Engine** | Fintech | Stripe webhooks, idempotency, state machine | No webhook signature verification |
| MD07 | **AI Content Studio** | AI/ML | LLM streaming, embeddings, moderation | No timeout on LLM stream (burns tokens) |
| MD08 | **Distributed Job Queue** | Background jobs | BullMQ, retries, DLQ, progress tracking | No idempotency (retry re-processes) |
| MD09 | **Social Feed Engine** | Social | Fan-out, ranking, cursor pagination | Fan-out blocks post creation (30s) |
| MD10 | **Multi-tenant Gateway** | Enterprise | Tenant isolation, RLS, API versioning | Missing RLS (cross-tenant leak) |

---

## 🔴 Tier 4: Advanced Projects (3-5 days each)

**Goal:** Multi-service systems with real complexity.

| # | Project | Domain | Architecture | The Bug |
|---|---------|--------|--------------|---------|
| A01 | **Real-time Auction** | Auctions | WebSockets + atomic bidding | Race condition: two bids at same time |
| A02 | **Message Queue** | Messaging | Custom queue from scratch | Messages lost on crash (no persistence) |
| A03 | **Search Engine** | Search | Inverted index + BM25 scoring | Scans entire table (no index, O(n)) |
| A04 | **Payment Orchestrator** | Fintech | Multi-provider with fallback | No fallback (primary fails = all fail) |
| A05 | **IoT Device Manager** | IoT | Device registry + telemetry | No device auth (fake telemetry accepted) |
| A06 | **Content Moderation** | AI/Trust | Pipeline + human review queue | Race: content approved and flagged simultaneously |

---

## ⚫ Tier 5: Expert Projects (1-2 weeks each)

**Goal:** These could be VC-backed startups.

| # | Project | Domain | What It Is | The Bug |
|---|---------|--------|-----------|---------|
| E01 | **TeamTask Pro** | SaaS | Multi-tenant project management (Asana clone) | Cross-tenant data access |
| E02 | **StreamForge** | Streaming | Live streaming platform backend (Twitch clone) | Unauthenticated stream start |

---

## 📚 Documentation Structure (Every Project)

```
project-name/
├── docs/
│   ├── 00-PROBLEM.md          # What we're building and why
│   ├── 01-THINKING.md         # Mental models, constraints, what-ifs
│   ├── 02-DECISIONS.md        # Architecture decisions with alternatives
│   ├── 03-CONCEPTS.md         # New concepts explained deeply
│   ├── 04-OLD-VS-NEW.md       # 2015 patterns vs 2025 patterns
│   ├── 05-BUILD.md            # Step-by-step from scratch
│   ├── 06-BUGS.md             # The bugs and real-world impact
│   ├── 07-RESEARCH.md         # Latest research and benchmarks
│   └── 08-CRITIQUE.md         # Senior engineer review
├── src/                        # Working code (with intentional bugs)
├── tests/                      # Tests that fail until bugs are fixed
├── README.md                   # Quick start and overview
├── package.json
├── tsconfig.json
└── docker-compose.yml          # If database/cache needed
```

---

## 🚀 How to Use

### For Beginners (Start Here)
```bash
cd projects/micro/M01-hello-api
cat docs/00-PROBLEM.md          # Understand the problem
cat docs/01-THINKING.md         # See how to think about it
cat docs/02-DECISIONS.md        # Learn why decisions matter
npm install && npm test         # See the failing test
# Fix the bug!
```

### For Job Seekers
Complete these for a hireable portfolio:
- 5 Micro projects (M01-M05) - show you know fundamentals
- 3 Small projects (S01, S03, S07) - show you can combine concepts
- 2 Medium projects (MD01, MD03) - show production awareness
- 1 Advanced project (A01 or A04) - show systems thinking

### For Mastery
Complete all 53 projects. By the end:
- You can debug any backend issue
- You can design systems from scratch
- You can explain WHY every decision was made
- You have a portfolio that gets you hired anywhere

---

## 📊 Stats

| Metric | Value |
|--------|-------|
| Total Projects | 53 |
| Total Lines of Code + Docs | 723,000+ |
| Micro Projects | 20 |
| Small Projects | 15 |
| Medium Projects | 10 |
| Advanced Projects | 6 |
| Expert Projects | 2 |
| Documentation Files | 477 (9 per project) |
| Intentional Bugs | 80+ |
| Domains Covered | 20+ |

---

## 🎯 What Makes This Different

1. **Thinking First** - Every project starts with 15 minutes of thinking before any code
2. **Multi-Angle** - Every decision shows 2-3 alternatives with trade-offs
3. **Old vs New** - Shows what we did in 2015 and why it's wrong in 2025
4. **Bugs Are Curriculum** - You learn by breaking and fixing, not just reading
5. **Research-Backed** - Decisions cite npm trends, benchmarks, OWASP, RFCs
6. **Critic-Reviewed** - Content was battle-tested by adversarial agents
7. **Progressive** - Each project builds on the last, no repetition

---

> *"I hear and I forget. I see and I remember. I do and I understand."* — Confucius
>
> *"The best time to plant a tree was 20 years ago. The second best time is now."* — Chinese Proverb
>
> **Start with M01. Fix the bug. Move to M02. Repeat 53 times. Become unstoppable.**
