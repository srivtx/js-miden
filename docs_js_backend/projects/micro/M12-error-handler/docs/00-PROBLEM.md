# The Problem

## What Are We Building?
An Express API that returns RFC 7807 Problem Details for all error scenarios, with a global error handler that catches synchronous, asynchronous, and post-response errors.

## Why Does This Problem Exist?
Every API fails. The difference between a good API and a bad API is not whether it has bugs, but how it communicates failure. Before RFC 7807 (2016), every API invented its own error format. Some returned `{ error: "..." }`. Some returned `{ message: "...", code: 123 }`. Some returned plain text. This inconsistency made client-side error handling a nightmare.

Worse, many APIs leak stack traces in production, giving attackers a roadmap of the server internals. Others crash with `ERR_HTTP_HEADERS_SENT` when an error occurs after the response has already started. Error handling is where production stability lives or dies.

## Who Will Use It?
- **API consumers** who need predictable error shapes to build robust retry logic.
- **DevOps engineers** who need error IDs to correlate user reports with logs.
- **Security auditors** who check whether stack traces or internal paths are exposed.

## Constraints
- **Time:** Error responses must be generated in <10ms. Error handling is on the critical path of every failed request.
- **Scale:** The error handler runs synchronously in the Express middleware chain. It must not block the event loop.
- **Correctness:** Errors must never crash the process. A crashing error handler is worse than the original error.
- **Budget:** Zero external services. Must work with only Express and Node.js built-ins.

## What We're NOT Building
- We are NOT building a distributed tracing system (no Jaeger, no Zipkin).
- We are NOT building a log aggregation pipeline (no ELK, no Datadog).
- We are NOT implementing retry logic on the client side.

---

## Why Error Handling Deserves Its Own Service

Error handling is not an afterthought. It is a first-class concern because:
1. **User trust:** A well-explained error preserves user trust. A cryptic 500 destroys it.
2. **Debuggability:** Without stack traces in development, bugs take 10x longer to find.
3. **Security:** With stack traces in production, attackers learn your file structure, dependencies, and internal logic.
4. **Stability:** An error handler that crashes the process turns a recoverable bug into a site-wide outage.

```
┌──────────────────────────────────────────────────────────────┐
│  The Error Handling Pipeline                                 │
│                                                              │
│  Route ──► Error thrown ──► Error caught by Express        │
│     │                              │                        │
│     │                              ▼                        │
│     │                    ┌─────────────────┐                │
│     │                    │ Custom Handler  │                │
│     │                    │                 │                │
│     │                    │ 1. headersSent? │──Yes──► Log   │
│     │                    │                 │        Abort  │
│     │                    └────────┬────────┘                │
│     │                             │ No                      │
│     │                             ▼                         │
│     │                    ┌─────────────────┐                │
│     │                    │ 2. Build RFC    │                │
│     │                    │    7807 body    │                │
│     │                    │                 │                │
│     │                    │ 3. Include stack│──Dev only──►  │
│     │                    │    if dev       │                │
│     │                    └────────┬────────┘                │
│     │                             │                         │
│     │                             ▼                         │
│     │                    ┌─────────────────┐                │
│     │                    │ 4. Generate     │                │
│     │                    │    errorId      │                │
│     │                    └────────┬────────┘                │
│     │                             │                         │
│     │                             ▼                         │
│     │                    ┌─────────────────┐                │
│     └───────────────────►│ res.status().   │                │
│                          │ json(problem)   │                │
│                          └─────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```
