# Production Backend Architecture: The Real Story (2025)

> **TL;DR for the impatient:** Most successful companies run on boring tech (PostgreSQL, Redis, a web framework, Docker). They fail on config errors, connection pools, and race conditions—not because they chose the wrong JavaScript framework. Kubernetes is overkill until you have ~50+ engineers. Your $1M ARR startup should spend under $1K/month on infrastructure.

---

## 1. Real Company Stacks

### Startups (<50 people)

**The actual pattern:** One monolith, one database, one cache. Hosted on Render/Railway/Fly.io or a single AWS/GCP account.

- **Database:** PostgreSQL (managed—Supabase, RDS, or Crunchy Data)
- **Cache:** Redis (Upstash or Elasticache)
- **Backend:** Node.js/Express, Python/FastAPI or Django, Ruby on Rails, or Go
- **Frontend:** React/Vue/Svelte deployed to Vercel/Netlify/Cloudflare Pages
- **Storage:** S3 or equivalent
- **Queue:** Redis-backed Bull/Sidekiq, or SQS

**Reality check:** Startups don't have "microservices." They have a monolith that someone calls "a service-oriented architecture" to feel better about the `if/else` spaghetti.

### Mid-size Companies (50-500 people)

**The actual pattern:** Monolith with extracted domain services. Still 1-3 primary databases.

- **Linear:** React + TypeScript frontend. Custom sync engine (not GraphQL) backed by PostgreSQL. Real-time updates via WebSockets. Rust/Go for performance-critical path.
- **Figma (at ~200 engineers):** Ruby on Rails monolith + Go services. PostgreSQL on RDS (vertically partitioned, then horizontally sharded). Redis for caching and real-time sessions. Custom DBProxy (Go) for query routing to shards. S3 for file storage.
- **Notion:** Started as Node.js monolith. Moved to a sharded PostgreSQL architecture as they scaled past millions of users. Still largely a monolith with critical paths extracted.
- **Stripe:** Ruby (with Sorbet type checking), PostgreSQL, Redis. Heavily invested in API reliability: idempotency keys, rate limiters (token bucket in Redis), load shedders. Not microservices—core API is a monolith with domain services around it.

**What they all have in common:** They didn't start with microservices. They extracted services when the monolith became a genuine bottleneck for *team* coordination, not because "microservices are best practice."

### Big Tech Companies

**The actual pattern:** Thousands of services, but most business logic still lives in monoliths or large domain services.

- **GitHub:** Ruby on Rails monolith ("github/github") + hundreds of smaller Rails apps for domains (Identity, Actions, Packages). MySQL clusters (the infamous `mysql1`), Redis, Elasticsearch, ProxySQL. Runs on Azure but maintains its own infrastructure abstractions.
- **Vercel:** Serverless compute platform. Under the hood: AWS (Lambda, CloudFront, Route53), Node.js runtime, distributed edge caching. The product is infrastructure.
- **Stripe:** Monolithic API with strict reliability engineering. Four types of rate limiters in production (request rate, concurrent request, fleet usage load shedder, worker utilization load shedder). Redis-backed token buckets. Load shedding kicks in during incidents to protect critical paths (charges/refunds) over non-critical (list/analytics).

**What big tech actually uses:**
- **Languages:** Java, Go, Rust, Python, Ruby, TypeScript. Not Haskell. Not Clojure.
- **Databases:** PostgreSQL, MySQL, Spanner/CockroachDB (only at very large scale). Not MongoDB for critical data.
- **Infra:** Kubernetes exists but teams fight it daily. Internal platforms hide K8s from developers. Most engineers deploy via `git push` to an internal PaaS.

---

## 2. What's Actually Hard in Production

These are extracted from real post-mortems (see [danluu/post-mortems](https://github.com/danluu/post-mortems) for the full database).

### Database Connection Pool Exhaustion

**The incident pattern:** Your app starts timing out. CPU is low. Database CPU is low. But requests hang for 20 seconds and then fail.

**What happened:** A slow query or a background job held connections. The pool (e.g., Go's `database/sql`, Prisma, Rails connection pool) ran out. New requests queued up waiting for a connection. The queue backed up. The site went down while the database was practically idle.

**Real example:** `incident.io` had two weeks of intermittent timeouts. Traces showed requests waiting up to 20s for a connection from Go's `database/sql` pool. After 24 deploys of fixes (indexes, materialized views, async handlers), the root cause was an unnecessary transaction wrapping every Slack modal submission—many small fast transactions collectively exhausted the pool.

**Lesson:** Monitor *pool wait time*, not just query duration. Use `ngrok/sqlmw` or similar middleware to attribute connection-pool hold time per operation.

### Memory Leaks in Long-Running Node Processes

**The incident pattern:** Your Node app restarts every few hours in production. Locally it runs forever.

**What happened:** Production has real traffic patterns—request buffers, closure scopes, event listeners, and global caches that grow unbounded. A common culprit: stats/logging libraries that append to an in-memory buffer that only flushes periodically.

**Real example:** AWS EBS had a memory leak in a reporting agent that continuously contacted a collection server. When it couldn't connect, it retried in a loop, slowly consuming system memory. The monitoring system failed to alarm because EBS servers "generally make very dynamic use of all memory."

**Lesson:** Always set memory limits and alerts. Use `--max-old-space-size` in Node. Profile memory in production, not just locally.

### Race Conditions in Payment Processing

**The incident pattern:** Customer is charged twice. Or a webhook is processed twice. Or a refund is issued twice.

**What happened:** Networks fail. Retries happen. Without idempotency, the same operation executes multiple times.

**Real example:** Knight Capital lost **$460 million** in 45 minutes due to a deployment race condition: a reused feature flag activated old, untested code on production servers. The code began buying high and selling low automatically.

**Stripe's defense:**
- **Idempotency keys:** Client generates a unique key (e.g., `Idempotency-Key: AGJ6FJMkGQIpHUTX`). Server stores the key -> response mapping. Retries with the same key return the cached response.
- **Exactly-once semantics:** For charge endpoints, the server locks on the idempotency key during processing. If the original request succeeded but the response was lost, the retry returns the cached success.
- **Exponential backoff + jitter:** Clients don't hammer the API when it's down. They back off with random jitter to avoid thundering herd.

**Lesson:** Every mutating API endpoint needs idempotency. Not eventually. Now.

### Cache Stampede During High Traffic

**The incident pattern:** Traffic spikes. Cache miss rate jumps to 100%. Database CPU hits 100%. Site dies.

**What happened:** A cached value expired. Thousands of concurrent requests all tried to regenerate it simultaneously. The regeneration is expensive (DB query, computation). The DB gets overwhelmed. The cache stays empty because requests are failing before they can repopulate it.

**Real example:** GitHub had a Saturday change that shortened a user-settings cache TTL from 12h to 2h. On Monday's peak, combined write amplification from cache rewrites plus read load overwhelmed the core auth/user-management database cluster, cascading through every service (github.com, API, Actions, Git over HTTPS, Copilot).

**Lesson:**
- Use **probabilistic early expiration** (refresh the cache before it expires, but only with a probability that increases as expiration nears).
- Use **locks** (e.g., Redis `SET NX`) so only one process regenerates the cached value.
- Never deploy cache TTL changes on Friday. Or Saturday, apparently.

### Third-Party API Failures (Cascading)

**The incident pattern:** A third-party API goes down. Your app goes down because every request waits 30 seconds for the timeout.

**What happened:** No circuit breaker. No timeout shorter than the default (often 30-120s). Every thread/process gets tied up waiting. The app can't serve other requests.

**Real example:** AWS S3 outage (Feb 28, 2017): A typo in a command removed more servers than intended. S3 went down. Since EC2, EBS, Lambda, and others depended on S3, it caused a vast cascading failure affecting hundreds of companies. The system underwent widespread outages for ~4.5 hours.

**Lesson:**
- Set **aggressive timeouts** on all external calls (5s, not 30s).
- Use **circuit breakers** (e.g., `opossum` in Node, `pybreaker` in Python). After N failures, fail fast for M seconds.
- Use **bulkheads**: Isolate thread pools for external calls so they can't consume all resources.

### The Most Educational Post-Mortems

1. **Cloudflare (July 2020):** A typo in Atlanta datacenter network config routed all Americas/Europe traffic to one datacenter, crushing it. *Lesson: Config changes need validation and canaries.*
2. **GitHub (Oct 2018):** 43-second network partition during maintenance caused MySQL master failover, but the new master lost several seconds of writes due to cross-continent latency. 24+ hours of restoration work. *Lesson: Network partitions happen. Your failover logic probably has bugs.*
3. **CircleCI (April 2025):** Blue/green DB upgrade succeeded, but post-cutover database ran every query against disk because statistics tables were stale after a second major-version upgrade. Workflows latency spiked, jobs dropped. *Lesson: Always `ANALYZE` after major version upgrades. And test the exact sequence you'll run in production.*
4. **GitHub (May 2021):** Foreign key on scoped-tokens table hit max INT32. High failure rates for Actions and Pages for 9h48m. *Lesson: Monitor integer column usage. Use INT64/BigInt for anything that grows.*

---

## 3. Anti-Patterns That Kill in Production

### "It Worked on My Machine"

| Local | Production |
|-------|-----------|
| Single user (you) | 10,000 concurrent users |
| SQLite / no connection limits | PostgreSQL with 100 connection limit |
| Filesystem cache | S3 with 100ms+ latency |
| No network partitions | Networks partition constantly |
| 16GB RAM, 8 cores | 1GB RAM, 1 core (container) |
| No logging pressure | 10,000 logs/sec flooding the parser |
| `npm start` | PM2/Docker with restart loops |

**Specific local-vs-production killers:**
- **File uploads:** Local: save to `/tmp`. Production: `/tmp` is ephemeral, container restarts, file vanishes.
- **Environment variables:** Local: `.env` loaded by framework. Production: missing vars silently default to `undefined` or `development` settings.
- **Case sensitivity:** Local macOS (case-insensitive). Production Linux (case-sensitive). `require('./Config')` works locally, fails in production.
- **DNS resolution:** Local: instant. Production: 5s timeout on every request if DNS is flaky.
- **Database migrations:** Local: `DROP TABLE` and re-run. Production: 500GB table, can't lock for more than 1s.

### Common "It Worked on My Machine" Moments

1. **The N+1 query:** Works fine with 10 rows locally. With 10,000 rows in production, each page load executes 10,001 queries.
2. **The unindexed query:** `SELECT * FROM orders WHERE user_id = ?` works instantly with 100 rows. With 10M rows, it's a table scan that times out.
3. **The memory leak:** Local: restart the server every hour while coding. Production: runs for days, slowly consumes all RAM, gets OOM-killed.
4. **The synchronous external call:** `await stripe.charges.create()` in a loop. Works locally with 3 charges. Production: 500 charges, each 200ms, blocks the event loop for 100 seconds.
5. **The missing rate limit:** Local API testing: 10 requests. Production: user script makes 10,000 requests/minute. API keys leaked to GitHub. $50,000 AWS bill.

### What Monitoring Catches That Tests Don't

- **Gradual degradation:** Memory leaks, connection pool exhaustion, disk space filling up. Tests pass, then it dies 6 hours later.
- **Distributed system failures:** Tests use in-memory stubs. Production: network latency, packet loss, DNS failures, certificate expiration.
- **Concurrency bugs:** Tests run sequentially. Production: two requests modify the same row simultaneously. Race conditions, deadlocks, lost updates.
- **Performance cliffs:** Tests use small datasets. Production: query planner chooses a different plan at scale. Index stops being used.
- **External dependency changes:** Third-party API changes response format, adds rate limits, or goes down. Tests mock the old behavior.

**The golden rule:** Tests verify your code does what *you* think it should. Monitoring verifies your code does what *reality* demands it does.

---

## 4. The Boring Tech Stack

### What's the "Boring" Stack That Just Works?

From Dan McKinley's seminal essay *[Choose Boring Technology](http://mcfunley.com/choose-boring-technology)* (originally from Etsy/Mailchimp):

> "If you choose to write your website in Node.js, you just spent one of your innovation tokens. If you choose to use MongoDB, you just spent one of your innovation tokens. If you choose to use service discovery tech that's existed for a year or less, you just spent one of your innovation tokens."

**The 2025 "boring but reliable" stack:**

| Layer | Technology | Why it's boring |
|-------|-----------|-----------------|
| Database | PostgreSQL | 30+ years old. Failure modes well understood. Handles JSON if you need it. |
| Cache | Redis | Simple data structures. Used by everyone. Operational playbooks exist. |
| Backend | Express (Node), Django/FastAPI (Python), Rails (Ruby), or Go | Pick one your team knows. Don't mix them. |
| Queue | Bull/Sidekiq on Redis, or SQS | Redis-backed queues are operationally simple. |
| Hosting | Render, Railway, Fly.io, or AWS ECS/Fargate | PaaS first. Don't manage servers until you have to. |
| Container | Docker | Standard. Portable. Boring. |
| Search | Postgres full-text search (good enough for <1M docs), then Elasticsearch | Don't add Elasticsearch until search is a real bottleneck. |
| Frontend | React/Vue + Vercel/Netlify | Static hosting is a solved problem. |

### When Do Companies Actually Need Kubernetes?

**Short answer:** Rarely. Most companies adopt K8s too early and pay a massive operational tax.

**You probably need Kubernetes when:**
- You have 50+ engineers and multiple teams deploying independently
- You need complex scheduling (GPU workloads, spot instances, mixed workloads)
- You have a platform team (3+ people) whose full-time job is cluster operations
- You genuinely need multi-cloud portability (almost no one does)
- You're running a SaaS platform where tenants need isolated namespaces

**You definitely don't need Kubernetes when:**
- You're a 5-person startup
- You have one monolith and one database
- Your "DevOps engineer" is also your backend engineer
- You don't know what a PodDisruptionBudget is
- You think Helm is a type of hat

**The real progression:**
1. **Prototype:** Localhost / Vercel / Glitch
2. **MVP:** Render / Railway / Fly.io (managed services, no K8s)
3. **Product-Market Fit:** AWS/GCP with ECS/Fargate or Cloud Run (containers, no cluster management)
4. **Scale:** EKS/GKE with a platform team

### Over-Engineered vs Under-Engineered

| Over-Engineered | Just Right | Under-Engineered |
|----------------|-----------|------------------|
| Microservices for <10 engineers | Monolith with clear module boundaries | Single 10,000-line file |
| Kubernetes for 2 services | ECS/Fargate or PaaS | SSH into production to restart |
| Kafka for 100 events/sec | Redis pub/sub or SQS | Polling the database every second |
| Cassandra for 1GB of data | PostgreSQL | SQLite in production |
| Custom auth service | Auth0/Clerk/Supabase Auth | JWTs with `secret` as the key |
| 9 micro-frontends | Single React app | jQuery with 50 script tags |
| Terraform for everything | Terraform for infra, scripts for apps | Clicking in the AWS console |

**The rule:** Solve the problem you have today with the simplest tool that works. Don't solve problems you might have in 2 years.

---

## 5. Cost Reality

### What's the Cheapest Reliable Stack for a Startup?

**Total monthly cost for a typical SaaS startup (0-10K users):**

| Service | Provider | Cost |
|---------|----------|------|
| App hosting | Render / Railway / Fly.io | $25-100/mo |
| Database | Supabase / RDS db.t3.micro | $15-50/mo |
| Cache | Upstash (serverless Redis) | $10-30/mo |
| File storage | Cloudflare R2 (no egress fees) | $5-20/mo |
| CDN | Cloudflare (free tier) | $0 |
| Email | Resend / Postmark | $10-20/mo |
| Monitoring | Datadog free tier / Sentry | $0-29/mo |
| **Total** | | **~$65-250/mo** |

**The cheat code:** Use Cloudflare R2 instead of S3 (zero egress fees). Use Supabase or Neon for PostgreSQL (generous free tiers). Use Vercel/Netlify for frontend (free tier handles most startups).

### When Does AWS Cost Become a Problem?

**AWS is expensive when:**
- **Data transfer:** NAT Gateway ($0.045/GB), cross-AZ traffic, S3 egress. A startup serving 10TB/month can spend $2,000+ just on data transfer.
- **Over-provisioning:** Running `m5.large` instances for a 100-user app because "it's the smallest production instance."
- **Managed services:** RDS Multi-AZ, ElastiCache, MSK, OpenSearch. Each adds 30-100% premium over self-managed.
- **Orphaned resources:** Someone created an ALB and forgot about it. $20/month forever.
- **Surprise scaling:** Lambda invocations that seemed cheap at 1K/day cost $500/month at 1M/day.

**AWS cost optimization playbook:**
1. Use Savings Plans or Reserved Instances for predictable workloads (30-40% savings)
2. Use Spot instances for background jobs (up to 90% savings)
3. Use CloudFront/R2/Cloudflare for egress, not S3 direct
4. Delete unused volumes, snapshots, and AMIs
5. Set billing alerts at $50, $100, $500. AWS won't stop charging you.

### Infrastructure Spending by Company Size

These are rough estimates based on public data, engineering blogs, and industry surveys:

| Stage | ARR | Engineering Team | Monthly Infra Spend | % of Revenue |
|-------|-----|------------------|---------------------|--------------|
| Seed / Pre-revenue | $0 | 2-5 | $200-1,000 | N/A |
| Early startup | $1M | 5-15 | $1,000-5,000 | 1.2-6% |
| Growth | $10M | 20-50 | $5,000-25,000 | 0.6-3% |
| Scale-up | $100M | 100-300 | $50,000-200,000 | 0.6-2.4% |
| Big Tech | $1B+ | 1000+ | $500,000-5M+ | 0.06-0.6% |

**What $1M ARR companies spend:**
- ~$1,000-3,000/month on hosting (PaaS or small AWS setup)
- Maybe one part-time contractor for DevOps
- No dedicated infrastructure team
- Focus: reliability, not cost optimization

**What $10M ARR companies spend:**
- ~$10,000-20,000/month on cloud infrastructure
- 1-2 DevOps/SRE hires
- Starting to think about multi-region, compliance (SOC2)
- Moving from PaaS to AWS/GCP for cost control

**What $100M ARR companies spend:**
- ~$100,000-500,000/month
- Dedicated SRE team (5-20 people)
- Multi-region active-active, disaster recovery
- Significant investment in internal developer platforms
- Negotiated enterprise cloud contracts (30-40% discounts)

**The counterintuitive truth:** Infrastructure cost as a percentage of revenue *decreases* as you scale. At $1M ARR, you might spend 3-5% on infra. At $100M ARR, you're spending <1%. The real cost is engineering time—a senior engineer costs $20K+/month. If Kubernetes costs you 0.5 engineers in operational overhead, it's only worth it if it saves you >$10K/month in infrastructure efficiency.

---

## Final Advice: What a Senior Engineer Would Tell a Junior

1. **Your database is the bottleneck.** Not your framework. Not your language. PostgreSQL done right handles millions of users. Most apps die because someone wrote an O(n²) loop, not because they chose Rails over NestJS.

2. **Add indexes before you add microservices.** A missing index can make a query 10,000x slower. A microservice architecture makes that query harder to fix.

3. **Observability > Testing in production.** You need tests, yes. But you also need to know what's happening *right now*. Add structured logging, distributed tracing, and metrics from day one. You can't debug what you can't see.

4. **Idempotency is non-negotiable.** Any API that modifies state must be safely retryable. Assume every network call will fail halfway through.

5. **Config changes are code changes.** The majority of major outages (Cloudflare, Facebook, AWS S3, Google Cloud) were caused by bad config, not bad code. Review config changes with the same rigor as code changes.

6. **Don't deploy on Fridays.** Or before holidays. Or before demos. The uptime you save may be your own.

7. **Rollback is a feature, not a procedure.** If your deployment takes 30 minutes to roll back, that's a bug. Blue/green deployments, feature flags, and database migrations that are backward-compatible are table stakes.

8. **The best code is no code.** Every line you write is a liability. Use managed services. Use boring tools. Use what your team already knows. The goal is to solve business problems, not to build the most elegant distributed system.

9. **Read post-mortems.** The GitHub repo `danluu/post-mortems` is a free master's degree in what actually breaks. Read one a week. You'll pattern-match failure modes before they happen to you.

10. **Production is the only load test that matters.** Load tests tell you what you already know to look for. Real users do things you didn't imagine. Canary deployments and feature flags are your friends.

---

*Sources: StackShare company profiles, Figma Engineering Blog ("How Figma's Databases Team Lived to Tell the Scale"), Linear Engineering Blog, Stripe Engineering Blog ("Scaling your API with rate limiters", "Designing robust and predictable APIs with idempotency"), GitHub Engineering Blog & Availability Reports, Dan McKinley's "Choose Boring Technology", danluu/post-mortems repository, AWS/Google Cloud incident reports, Cloudflare post-mortems, Hacker News engineering discussions.*

*Compiled May 2026. The tech changes. The failure modes don't.*
