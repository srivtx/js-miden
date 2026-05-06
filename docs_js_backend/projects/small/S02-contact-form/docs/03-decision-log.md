# S02 Contact Form — Decision Log

## Decision: In-Memory vs Redis Rate Limiting

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| In-Memory Map | Zero infra, sub-microsecond | Per-process only; resets on deploy; unfair under load balancer | ❌ Rejected |
| Redis Counter | Shared across instances; survives restart | Network latency (~1ms); extra dependency | ✅ Chosen |
| PostgreSQL | Already have DB | Much slower writes; not designed for high-frequency counters | ❌ Rejected |

**Rationale**: A contact form is usually behind a load balancer. In-memory rate limiting is useless with >1 replica. Redis is the industry standard for distributed counters.

## Decision: Fixed Window vs Sliding Window

| Approach | Memory | Accuracy | Complexity |
|----------|--------|----------|------------|
| Fixed Window | O(1) | Poor at boundary | Very low |
| Sliding Window Log | O(n) | Perfect | Medium |
| Sliding Window Counter | O(1) | Good | Medium |

We chose fixed window because:
1. The boundary-burst risk is acceptable for a contact form (max 3 requests/hour).
2. It requires a single `INCR` + `PEXPIRE` — two Redis commands.
3. Sliding window logs would store up to 3 timestamps per IP; over millions of IPs this becomes significant.

If the limit were 1000 req/min, sliding window would be worth the extra complexity.

## Decision: Honeypot vs CAPTCHA

| Approach | Bot Catch Rate | UX Impact | Accessibility | Implementation |
|----------|---------------|-----------|---------------|----------------|
| Honeypot | ~60-80% | None | Risky if not hidden properly | Trivial |
| reCAPTCHA v2 | ~99% | Annoying (click cars) | Screen-reader hostile | Google SDK |
| reCAPTCHA v3 | ~99% | Invisible | Better | Google SDK + score threshold |
| hCaptcha | ~99% | Moderate | Moderate | Third-party script |

We chose honeypot as the first layer because:
- It adds zero friction for legitimate users.
- It blocks naive scrapers instantly.
- If spam volume rises, we can add reCAPTCHA v3 **without removing** the honeypot.

## Decision: No Database

| Approach | Privacy | Durability | Auditability |
|----------|---------|------------|--------------|
| No DB (console logs) | Excellent | None | Poor |
| SQLite file | Moderate | Good | Good |
| PostgreSQL | Moderate (needs encryption) | Excellent | Excellent |
| Message queue (SQS/RabbitMQ) | Good (transient) | Good | Moderate |

We chose no DB to minimize GDPR scope. The trade-off is that submissions disappear when the process restarts. For production, a message queue is the next step: it gives durability without long-term PII retention.

## Decision: `validator` vs Custom Regex

| Approach | Coverage | Maintenance | Performance |
|----------|----------|-------------|-------------|
| `validator` library | RFC-compliant, battle-tested | Community maintained | Fast enough |
| Custom regex | Easy to get wrong | You maintain it | Marginally faster |
| HTML5 `type="email"` | Browser-level | Browser maintained | Client-side only |

We chose `validator` because email regex is a famously bad idea. The library handles edge cases (IDN domains, quoted strings) that a custom regex misses.

## Decision: Fail-Open on Redis Failure

| Approach | Availability | Security Risk | When to Use |
|----------|--------------|---------------|-------------|
| Fail-open (allow) | High | Temporary DDoS exposure | Public forms, read APIs |
| Fail-closed (reject) | Low | None | Auth, payments, admin panels |

We chose fail-open so that a Redis outage does not take down the contact page. The blast radius is small: spammers get a brief window.
