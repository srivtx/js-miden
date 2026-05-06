# 02-DECISIONS.md

## Decision 1: Queue Storage

**Chosen:** In-memory `Map<string, QueuedEmail>` for the demonstration.

**Alternatives:**
- **Redis List / BullMQ**: Production-grade persistence, worker scaling, job scheduling. Adds infrastructure dependency.
- **PostgreSQL with SKIP LOCKED**: Durable, transactional, no new infrastructure if you already have Postgres. Slower than Redis.
- **AWS SQS / RabbitMQ**: Cloud-native, massive scale. Vendor lock-in and cost.

**Why in-memory:** Keeps the project self-contained and runnable with `npm start`. The bugs demonstrated (synchronous send, no retry) are independent of storage choice.

---

## Decision 2: Template Engine

**Chosen:** Simple `{{variable}}` string replacement with `RegExp`.

**Alternatives:**
- **Handlebars / Mustache**: Full logic-less templating, partials, helpers. Overkill for two templates.
- **MJML / React Email**: HTML email frameworks with responsive layouts. Essential for production marketing emails.
- **Liquid**: Shopify's engine, safe sandboxing. Good for user-generated templates.

**Why simple replacement:** Demonstrates the concept without pulling in 50KB of dependencies. The bug surface (missing variables) is the same regardless of engine.

---

## Decision 3: SMTP Abstraction

**Chosen:** Mock `mockSmtpSend()` with 500ms delay and bounce simulation.

**Alternatives:**
- **Nodemailer + Ethereal.email**: Real SMTP against a fake mailbox service. Adds network dependency.
- **SendGrid/SES SDK**: Real provider integration. Requires API keys and billing.
- **MailHog / Mailpit**: Local SMTP capture server. Requires Docker.

**Why mock:** Guarantees reproducible tests without network calls or credentials. The architectural lessons (queue, retry) are identical.

---

## Decision 4: Retry Strategy

**Chosen:** Exponential backoff with 3 attempts (demonstrated in corrected code).

**Alternatives:**
- **Fixed interval**: Every 5 minutes. Simple but creates thundering herds.
- **Linear backoff**: 1min, 2min, 3min. Better but still clusters retries.
- **Exponential backoff + jitter**: 1min, 2min, 4min + random(0-30s). Industry standard (AWS, Google).

**Why exponential:** Mathematically optimal for avoiding congestion collapse (Jain & Chiu, 1989).

---

## Decision 5: Language / Runtime

**Chosen:** TypeScript + Node.js with native `node:test`.

**Alternatives:**
- **Python + FastAPI + Celery**: Excellent for data-heavy teams. Slower event loop for I/O-bound work.
- **Go + Gin**: Goroutines make concurrency trivial. Less mature email ecosystem.
- **Java + Spring Boot**: Enterprise standard. Heavyweight for a 100-line service.

**Why Node.js:** Single-threaded event loop naturally demonstrates the blocking bug. Native test runner requires zero dependencies.
