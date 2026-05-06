# Express.js Backend Mastery — Project Collection

> **108 production-grade projects.** From 30-minute micro-concepts to 2-week expert systems. Every project has runnable code, intentional bugs, and deep documentation explaining **what**, **why**, and **what happens if you do it wrong**.

---

## Philosophy

The only way to learn backend engineering is to **build things, break them, and fix them**.

Every project follows the **Thinking Framework**:

| Phase | Question | What You Do |
|-------|----------|-------------|
| **1** | What are we building? | Understand the problem, constraints, success criteria |
| **2** | How should we think about it? | Mental models, hot path, danger zones, what-if game |
| **3** | What decisions matter? | Evaluate alternatives, trade-offs, pick with justification |
| **4** | How do we build it? | Step-by-step from empty folder, every import explained |
| **5** | What breaks? | Find the intentional bug, understand real-world impact, fix it |

---

## Project Tiers

| Tier | Count | Time Each | What You Learn |
|------|-------|-----------|----------------|
| **Micro** | 35 | 30-60 min | Single concepts in isolation |
| **Small** | 30 | 2-4 hours | Combining 2-3 concepts |
| **Medium** | 20 | 1-2 days | Production-ready features |
| **Advanced** | 14 | 3-5 days | Multi-service systems |
| **Expert** | 7 | 1-2 weeks | Startup-grade platforms |
| **Total** | **108** | **6-12 months** | **Complete backend mastery** |

---

## Quick Start

```bash
# Pick a tier and project
cd projects/micro/M01-hello-api

# Read the problem
cat docs/00-PROBLEM.md

# See the thinking process
cat docs/01-THINKING.md

# Run the tests (some will fail — that's the bug)
npm install && npm test

# Find and fix the bug!
```

---

## Documentation Structure (Every Project)

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
├── tests/                      # Tests that fail until you fix the bugs
├── README.md                   # Quick start
├── package.json                # Express 5 + TypeScript + ESM + Vitest
├── tsconfig.json
└── docker-compose.yml          # If database/cache needed
```

---

## Highlighted Projects

### Beginner-Friendly
- **M01** Hello API with Logging — First Express server, structured logging
- **M04** Counter API (Redis) — Atomic operations, race conditions
- **M07** JWT Auth — Tokens, claims, expiry, cookies
- **S01** Todo API — Full CRUD, validation, soft delete

### Job-Interview Ready
- **M21** Circuit Breaker — Failure detection, state machines
- **S26** File Upload Service — Security, validation, image processing
- **MD01** E-Commerce Cart — Inventory, checkout, race conditions
- **MD11** GraphQL Server — Schema design, complexity limits

### Advanced Systems
- **A07** gRPC Microservices — Protocol buffers, deadlines, streaming
- **A15** Video Streaming — HLS/DASH, range requests, CDN
- **A17** Financial Ledger — Double-entry bookkeeping, precision

### Expert-Level
- **E03** DataSync — CRDTs, offline-first, conflict resolution
- **E05** Code Execution Engine — Sandboxing, resource limits
- **E07** Autoscaling Platform — Control theory, hysteresis, flapping

---

## Tech Stack (Consistent Across All Projects)

- **Runtime**: Node.js 20+ with Express 5
- **Language**: TypeScript with strict mode
- **Module System**: ESM (`"type": "module"`)
- **Testing**: Vitest + Supertest
- **Database**: PostgreSQL (via Prisma ORM)
- **Cache/Queue**: Redis
- **Validation**: Zod
- **Logging**: Pino

---

## Stats

| Metric | Value |
|--------|-------|
| Total Projects | 108 |
| Documentation Files | 972 (9 per project) |
| Intentional Bugs | 120+ |
| Domains Covered | 25+ |
| Lines of Code + Docs | 1,200,000+ |

---

## Learning Paths

### Path A: Complete Journey (Recommended)
Follow every module in order. This takes ~8-12 weeks part-time.

### Path B: Pragmatic Path (Need to ship NOW)
1. M01-M05 (fundamentals)
2. S01, S03, S07 (combining concepts)
3. MD01, MD03 (production awareness)
4. A01 or A04 (systems thinking)

### Path C: Architecture Path (Leveling up)
1. M21-M30 (resilience patterns)
2. S16-S20 (API design, GraphQL, event sourcing)
3. MD11-MD15 (GraphQL, analytics, monitoring, CDC)
4. A07-A17 (microservices, real-time, finance)
5. E03-E07 (expert systems)

---

> *"I hear and I forget. I see and I remember. I do and I understand."* — Confucius
>
> **Start with M01. Fix the bug. Move to M02. Repeat 108 times. Become unstoppable.**
