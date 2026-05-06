# Architecture Decisions

## Decision: Sync vs Async Logging

### Option A: console.log (Synchronous)
**Pros:**
- Zero dependencies.
- Guaranteed ordering. Log line N always appears before log line N+1.
- Never loses logs due to process crashes (the write completes before the next tick).

**Cons:**
- **Blocks the event loop.** Under high load, synchronous I/O to stdout can degrade throughput by 30-50%.
- No structured formatting. You must manually JSON.stringify everything.
- No log levels. Every message is treated the same.

### Option B: Async Logger (pino with sync: false)
**Pros:**
- Does not block the event loop. Logs are buffered and flushed asynchronously.
- Structured JSON output with log levels (info, warn, error).
- Extremely fast (pino benchmarks at ~100,000 logs/sec).

**Cons:**
- One dependency.
- Potential for log loss if the process crashes before the buffer is flushed.
- Slightly more complex configuration.

### Option C: Worker Thread Logger
**Pros:**
- Completely decouples logging from the main thread.
- Zero main-thread blocking.

**Cons:**
- Complex. Message passing overhead.
- Overkill for a micro project.

### What We Chose: Option A (for learning), with Option B recommended for production.
**Why:** For a learning project, `console.log` on `res.on('finish')` is sufficient to demonstrate the concepts. For production, we explicitly recommend switching to `pino` with `sync: false`.

**What If We Chose Wrong:** Using `console.log` in production under high load would create a bottleneck. Using `pino` in a learning project would add unnecessary complexity.

**Research Backing:** Pino benchmarks show 5-10x throughput improvement over `console.log` under load. Node.js documentation warns that `process.stdout` is synchronous by default in TTYs.

---

## Decision: Sensitive Data Redaction

### Option A: Log Everything (Current Buggy Implementation)
**Pros:**
- Complete request trace. Useful for debugging.

**Cons:**
- **Passwords, tokens, PII leak into logs.** Logs are often less secure than databases.
- Third-party log aggregators may retain data longer than your retention policy.
- GDPR and CCPA violations if PII appears in logs.

### Option B: Deny-List Redaction
**Pros:**
- Explicitly redacts known sensitive fields (`password`, `token`, `ssn`).
- Easy to extend with new fields.
- Preserves non-sensitive data for debugging.

**Cons:**
- You might miss a sensitive field (e.g., `cvv` instead of `creditCard`).
- Recursive redaction has a small performance cost.

### Option C: Allow-List Only
**Pros:**
- Only logs known-safe fields. Impossible to accidentally leak sensitive data.
- Maximum security.

**Cons:**
- Requires maintaining an allow-list for every endpoint.
- May omit useful debugging data.
- Inflexible for rapid development.

### What We Chose: Option B
**Why:** A deny-list strikes the best balance. It protects the most dangerous fields (passwords, tokens) while preserving the flexibility to log other request data. It is also the industry standard — most logging libraries (pino, winston) support deny-list redaction out of the box.

**What If We Chose Wrong:** Logging everything would leak credentials. Allow-list only would make debugging painful and require constant maintenance.

**Research Backing:** OWASP Logging Cheat Sheet recommends redacting sensitive data. GDPR Article 32 requires protection of personal data "in transit and at rest" — logs are "at rest."

---

## Decision: Log Rotation & Retention

### Option A: Stdout Only
**Pros:**
- Simplest approach. Let the process manager (systemd, Docker) handle rotation.
- Works perfectly in containerized environments.

**Cons:**
- No local log files for offline analysis.
- Container restart = log loss unless shipped externally.

### Option B: File with Rotation (pino-roll, logrotate)
**Pros:**
- Automatic daily/hourly rotation.
- Local files for offline debugging.

**Cons:**
- Requires disk space monitoring.
- File I/O can be slower than stdout.
- `logrotate` can drop logs if not configured with `copytruncate` or `create`.

### Option C: Centralized (Datadog, ELK, CloudWatch)
**Pros:**
- Immediate off-host shipping.
- Built-in search, alerting, and retention policies.

**Cons:**
- Vendor lock-in.
- Cost scales with log volume.
- Network dependency.

### What We Chose: Option A with Option C recommended for production.
**Why:** Writing structured JSON to stdout is the 12-Factor App standard. In containerized environments (Docker, Kubernetes), stdout is collected by the platform and shipped to centralized logging automatically. For VM-based deployments, file rotation is necessary.

**What If We Chose Wrong:** Writing to files in containers would fill the overlay filesystem and cause container eviction. Relying solely on stdout in VMs would lose logs on reboot.

---

## Decision: When to Log (Timing)

### Option A: Log at Request Start
**Pros:**
- You always have a log, even if the route crashes.
- Simple to implement.

**Cons:**
- You don't know the status code yet.
- You don't know the response time yet.
- Duplicate logs if you also log at the end.

### Option B: Log at Response Finish
**Pros:**
- Status code and duration are known.
- Does not block the response.
- Single log per request.

**Cons:**
- If the process crashes mid-request, you get no log.
- Slightly more complex (attach to `res.on('finish')`).

### Option C: Log at Both Start and End
**Pros:**
- Complete request lifecycle visibility.
- Can calculate queue time (start time minus arrival time).

**Cons:**
- Double the log volume.
- More complex correlation.

### What We Chose: Option B
**Why:** For most APIs, the response status and duration are the most important metrics. Attaching to `res.on('finish')` guarantees these are available without blocking the response. For critical systems, Option C (start + end) provides better observability at the cost of log volume.

**What If We Chose Wrong:** Logging at start only would mean never knowing if a request succeeded. Logging at both would double costs in log aggregation systems.
