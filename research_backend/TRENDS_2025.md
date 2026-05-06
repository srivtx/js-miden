# Node.js / Express Backend Ecosystem Trends 2025-2026

> Research compiled: May 2026
> Sources: npmjs.com, State of JS 2024, Stack Overflow Developer Survey 2025, JetBrains Developer Ecosystem 2024, official project documentation.

---

## 1. Package Download Trends (npmjs.com, State of JS)

### Web Frameworks — Express Still Dominates, But Hono Is the Fastest Grower

| Framework | Weekly Downloads (npm) | State of JS 2024 Rank (Usage) |
|-----------|------------------------|------------------------------|
| **Express** | ~93,000,000 | #1 (7,044 respondents) |
| **Hono** | ~34,300,000 | #5 (1,081 respondents) |
| **Fastify** | ~6,800,000 | #3 (1,526 respondents) |
| **NestJS** | — | #2 (3,073 respondents) |
| **ElysiaJS** | — | #7 (383 respondents) |

**Key Findings:**
- **Express remains #1** by a massive margin in raw downloads (~93M/week) and survey usage.
- **Hono is the breakout story of 2024-2025**: despite being newer, it has pulled ahead of Fastify in *weekly downloads* (~34M vs ~7M). Its growth is driven by multi-runtime support (Cloudflare Workers, Deno, Bun, Node.js), Web Standards API compliance, and a tiny bundle size (<12KB).
- **Fastify** remains the performance-focused choice for Node.js purists but has slower download growth compared to Hono.
- **ElysiaJS** (Bun-native) is niche but growing within the Bun ecosystem.

### ORM Trends — Prisma vs Drizzle vs Kysely

| ORM / Query Builder | Weekly Downloads (npm) | Notes |
|---------------------|------------------------|-------|
| **Prisma** | ~10,400,000 | Market leader, mature ecosystem, Prisma Postgres launched |
| **Kysely** | ~4,200,000 | Type-safe SQL query builder, rising fast in TypeScript community |
| **Drizzle ORM** | ~3,500,000 (estimated)* | Lightweight, SQL-like API, popular in new projects |

*Drizzle does not publish a single package name; estimated from combined related packages.

**Key Findings:**
- **Prisma** is still the default ORM for new TypeScript projects but faces criticism for bundle size, query engine binary, and migration rigidity.
- **Drizzle** is the "developer's darling" for 2024-2025 — lightweight, SQL-like, and heavily promoted in the T3 Stack and YouTube ecosystem.
- **Kysely** is gaining traction as a "type-safe Knex" for teams that want full SQL control without an ORM abstraction.

### Testing — Vitest Is Eating Jest's Lunch

| Tool | Weekly Downloads | State of JS 2024 "Used at Work" | Retention |
|------|------------------|--------------------------------|-----------|
| **Jest** | ~18,000,000* | #1 (7,262) | Declining |
| **Vitest** | ~56,700,000 | #3 (3,986) | **98%** |
| **Playwright** | ~4,500,000* | #4 (3,674) | High |
| **Cypress** | ~3,800,000* | #5 (3,603) | Flat |
| **Node Test Runner** | ~2,000,000* | #11 (435) | Growing |

*Estimated from npm trends and secondary sources.

**Key Findings:**
- **Vitest** has **98% retention** (State of JS 2024) and was the **#2 Most Adopted Technology** (+26% YoY usage). It tops interest, retention, and positivity rankings.
- **Jest** is still #1 in absolute workplace usage but is losing mindshare. Pain points include ESM/CJS compatibility, slow performance, and configuration complexity.
- **Node.js native test runner** is still early in adoption (#11 at work, 435 respondents) but is the default choice for zero-dependency projects.

---

## 2. Production Stack Surveys (State of JS, Stack Overflow, JetBrains)

### Database Usage

| Database | Stack Overflow 2025 (All) | Stack Overflow 2025 (Professional) | Trend |
|----------|---------------------------|-----------------------------------|-------|
| **PostgreSQL** | **55.6%** | **58.2%** | Most desired & admired |
| **MySQL** | 40.5% | 39.6% | Stable |
| **SQLite** | 37.5% | 36.9% | Stable |
| **MongoDB** | 24.0% | 24.3% | Flat |
| **Redis** | 28.0% | 30.7% | **+8% growth** |

**Key Findings:**
- **PostgreSQL** is the most desired AND most admired database for the third consecutive year. It is the default choice for new Node.js backends.
- **Redis** saw the largest growth (+8%) driven by caching, real-time features, and AI/LLM context stores.
- **MongoDB** remains popular but is no longer the default for new projects; PostgreSQL with JSONB has eaten its lunch for many use cases.

### TypeScript Is Now the Default

| Survey | TypeScript Adoption |
|--------|---------------------|
| **Stack Overflow 2025** | 43.6% all respondents / **48.8% professional developers** |
| **JetBrains 2024** | 35% of all developers (up from 12% in 2017) |
| **State of JS 2024** | ~70%+ of respondents use TypeScript for JS projects |

**Key Findings:**
- **TypeScript is now the default for new Node.js projects.** The JetBrains Language Promise Index ranks TypeScript as the #1 language with the strongest future growth trajectory.
- Among AI-using professionals, TypeScript adoption is even higher (**51.4%**).
- The consensus in 2025: starting a new backend project in plain JavaScript is considered a deliberate retro choice.

### Deployment & Infrastructure

| Technology | Stack Overflow 2025 (All) | Stack Overflow 2025 (Professional) |
|------------|---------------------------|-----------------------------------|
| **Docker** | **71.1%** | **73.8%** |
| **npm** | 56.8% | 59.3% |
| **AWS** | 43.3% | 45.9% |
| **Kubernetes** | 28.5% | 30.1% |
| **Vercel** | 10.6% | 10.8% |
| **Bun** | 5.5% | 5.6% |

**Key Findings:**
- **Docker** is now near-universal (+17 point jump from 2024, largest single-year increase of any technology surveyed).
- **Bun** is at ~5.5% usage but has massive interest; it is not yet mainstream for production backends.
- **Vercel** remains dominant for frontend deployments but is expanding into backend via AI SDK, Fluid Compute, and Marketplace partnerships.

---

## 3. Emerging Technologies (2025)

### Hono.js — Why It's Growing, Should We Care?

**YES.** Hono is one of the fastest-growing backend frameworks in the JavaScript ecosystem.

- **Weekly downloads**: ~34M (approaching half of Express)
- **Philosophy**: Ultra-fast, lightweight (<12KB), Web Standards-based, zero dependencies
- **Killer feature**: Runs everywhere — Node.js, Cloudflare Workers, Deno, Bun, AWS Lambda, Fastly Compute
- **State of JS 2024**: #5 backend framework (1,081 respondents), ahead of Koa and Adonis

**Verdict:** Hono is the framework of choice for edge/serverless deployments. If you are building APIs for Cloudflare Workers or Vercel Edge Functions, Hono is the default.

### Vercel AI SDK — How Backends Integrate LLMs

- **Current version**: v6.x (as of early 2026)
- **What it does**: Standardizes LLM integration across OpenAI, Anthropic, Google, Azure, AWS Bedrock, Groq, Mistral, and 15+ providers
- **Key features**: Agents, Model Context Protocol (MCP), tool calling, structured object generation, streaming
- **Backend impact**: Node.js backends are increasingly expected to expose `/api/chat`, `/api/agent`, and `/api/tools` endpoints. The AI SDK is the default toolkit for this.

**Verdict:** If your backend does not have an AI integration strategy in 2025, it is behind. Vercel AI SDK is the most adopted abstraction layer.

### Temporal / Inngest — Workflow Engines Replacing Cron

| Tool | Funding / Valuation | Focus |
|------|---------------------|-------|
| **Temporal** | **$300M Series D at $5B valuation** (2025) | Durable execution, long-running workflows, AI agent orchestration |
| **Inngest** | **$21M Series A** (Sep 2025) | Durable functions, queue abstraction, AI agents, cron replacement |

**Key Findings:**
- **Temporal** is becoming the "Kubernetes of workflows" — the default for complex, long-running business processes.
- **Inngest** is the developer-friendly alternative: write functions, add `step.run()`, and get retries, concurrency control, and observability for free.
- Both are heavily positioning around **AI agent orchestration** — replacing brittle cron jobs with durable, observable, retryable workflows.
- Inngest launched **Durable Endpoints** (Feb 2026) to add durability directly to REST APIs without queue infrastructure.

**Verdict:** Traditional cron jobs and raw Redis queues are being replaced by durable execution platforms. For Node.js backends, Inngest is the easiest on-ramp.

### Zod Ecosystem — zod-openapi, t3-stack Influence

- **Zod weekly downloads**: **~159,000,000**
- **State of JS 2024**: #3 most-used library (4,117 respondents), behind only Lodash and date-fns
- **Ecosystem**: zod-openapi, tRPC, Drizzle ORM, React Hook Form, and nearly every modern TypeScript tool

**Key Findings:**
- Zod is no longer just a validation library; it is the **schema layer of the modern TypeScript stack**.
- The **T3 Stack** (tRPC + Tailwind + Prisma + Zod) has made Zod the default for API contracts.
- **zod-openapi** and related tools are replacing handwritten OpenAPI specs with inferred schemas.

### Biome — Is It Replacing ESLint + Prettier?

- **Current version**: v2.4 (Feb 2026)
- **Positioning**: "Toolchain of the web" — linter, formatter, and soon type checker in one tool
- **Performance**: Written in Rust, significantly faster than ESLint + Prettier
- **Key milestones**: Vercel partnership for type inference, GritQL plugin language, Depot platinum sponsorship

**Key Findings:**
- **Biome is not yet the default** but is gaining rapidly in new projects.
- It supports Vue, Svelte, Astro, HTML accessibility rules, and embedded CSS/GraphQL formatting.
- The main friction is ecosystem migration from `.eslintrc` and `.prettierrc` configs.

**Verdict:** For new projects in 2025-2026, Biome is the recommended choice. For legacy projects, migration is optional but increasingly appealing.

### OpenTelemetry — Is It Finally Mainstream?

- **@opentelemetry/api weekly downloads**: **~49,500,000**
- **Status**: Yes, it is mainstream.

**Key Findings:**
- With ~50M weekly downloads, OpenTelemetry is the de facto standard for observability in Node.js.
- Major platforms (Vercel, Datadog, Grafana, New Relic) all natively support OTLP ingestion.
- Inngest, Temporal, and AI SDK all ship with OpenTelemetry integration out of the box.

---

## 4. What Tech Twitter / HackerNews Is Talking About

### What's Controversial Right Now
1. **"Is Express dead?"** — No, but it is increasingly seen as the "safe legacy choice." The lack of built-in TypeScript support and middleware modernization fuels debate.
2. **Bun vs Node.js** — Bun's speed claims are impressive, but production stability and ecosystem compatibility remain questioned. Node.js 22+ has closed some performance gaps.
3. **AI-generated code quality** — Stack Overflow 2025: **66%** of developers are frustrated with "AI solutions that are almost right, but not quite."
4. **The death of REST?** — tRPC, GraphQL, and AI SDK streaming are challenging traditional REST API design patterns.

### What's Being Adopted Rapidly
- **Vitest** (+26% YoY usage, State of JS 2024)
- **Hono** (edge-first APIs)
- **Drizzle ORM** (lightweight alternative to Prisma)
- **Inngest / Temporal** (durable execution)
- **Biome** (fast linting/formatting)
- **Vercel AI SDK** (LLM integration)
- **Tailscale / WireGuard** (zero-config networking for microservices)

### What's Being Abandoned
- **Jest** (slowly losing to Vitest)
- **Mocha** (legacy, minimal new adoption)
- **Moment.js** (replaced by date-fns, Day.js, or Temporal API)
- **Knex.js** (replaced by Kysely and Drizzle)
- **Hand-written cron jobs** (replaced by Inngest, Temporal, or managed schedulers)

---

## 5. Skills Gap — What Backend Job Postings Ask For

### What Junior Devs Don't Know (But Should)
1. **Durable Execution / Workflow Orchestration** — Inngest, Temporal, or Step Functions
2. **Observability** — OpenTelemetry, structured logging, distributed tracing
3. **Type-Safe APIs** — tRPC, Zod, OpenAPI generation
4. **AI Integration** — Vercel AI SDK, tool calling, streaming LLM responses
5. **Modern Testing** — Vitest, Playwright, Node Test Runner (not just Jest)
6. **Edge/Serverless Runtimes** — Cloudflare Workers, Vercel Edge, Hono
7. **Database Performance** — Query optimization, indexing, connection pooling (PgBouncer)
8. **Zero-Config Networking** — Tailscale, WireGuard for microservice communication

### Common Interview Topics for Node.js Backend Roles (2025)
1. **Event Loop & Async Patterns** — Still the #1 technical deep-dive topic
2. **TypeScript Advanced Types** — Generics, conditional types, inferred schemas
3. **API Design** — REST vs tRPC vs GraphQL; versioning; rate limiting
4. **Authentication** — JWT vs sessions vs OAuth2/OIDC; refresh token rotation
5. **Database Design** — PostgreSQL indexing, migrations, normalization vs denormalization
6. **Docker & Containerization** — Multi-stage builds, health checks, compose vs Kubernetes
7. **System Design** — Caching strategies (Redis), message queues, horizontal scaling
8. **AI Integration** — How to safely expose LLM capabilities in production APIs

---

## Summary: Top 10 Findings

1. **Express is still #1** (~93M weekly downloads), but Hono is the fastest-growing backend framework (~34M downloads, #5 in State of JS).
2. **TypeScript is the default** for new Node.js projects — 48.8% of professional developers use it (Stack Overflow 2025), up from 12% in 2017.
3. **PostgreSQL dominates** new backend projects (55.6% usage, most desired & admired database for 3 years straight).
4. **Vitest is replacing Jest** — 98% retention, +26% YoY usage, and tops all satisfaction metrics in State of JS 2024.
5. **Zod is the schema king** — 159M weekly downloads, #3 library in State of JS, powers the T3 Stack ecosystem.
6. **Docker is near-universal** — 71.1% usage, +17 point jump from 2024 (largest single-year increase in Stack Overflow survey).
7. **Durable execution is the new cron** — Temporal ($5B valuation) and Inngest ($21M Series A) are replacing raw queues and cron jobs.
8. **OpenTelemetry is mainstream** — ~50M weekly downloads, default for observability in modern Node.js stacks.
9. **AI SDK integration is now a backend requirement** — Vercel AI SDK v6 standardizes LLM integration across 15+ providers.
10. **The biggest skills gap** is in workflow orchestration (Temporal/Inngest), observability (OpenTelemetry), and AI integration — not basic CRUD API development.

---

*Disclaimer: Download numbers fluctuate daily and are snapshots from npmjs.com in May 2026. Survey data reflects 2024-2025 respondent cohorts.*
