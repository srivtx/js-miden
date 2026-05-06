# The Problem

## What Are We Building?
An Express middleware that logs every HTTP request with structured metadata (method, path, status, duration, user-agent) while redacting sensitive fields from request bodies.

## Why Does This Problem Exist?
Every production API needs request logs. They are essential for debugging, monitoring, and security forensics. But logging is also one of the most dangerous places for data leaks. A single unredacted password in a log file can compromise an entire system, especially when logs are shipped to third-party services (Datadog, CloudWatch, Splunk) that have different security boundaries than your database.

According to Verizon's 2023 Data Breach Investigations Report, credential theft remains the #1 attack vector. Logs are a common source of leaked credentials because developers treat them as "internal only" without realizing that "internal" includes SREs, support staff, and third-party log aggregators.

## Who Will Use It?
- **SREs and DevOps** who monitor API health and trace incidents.
- **Security teams** who audit whether sensitive data appears in logs.
- **Developers** who debug production issues using request traces.

## Constraints
- **Time:** Logging must not block the response. The user should receive their data before logging completes.
- **Scale:** Under high load, synchronous logging can degrade throughput. We need to understand sync vs async tradeoffs.
- **Correctness:** A single missed redaction is a security incident.
- **Budget:** Zero external services. Must work with only Express and Node.js built-ins.

## What We're NOT Building
- We are NOT building a distributed tracing system (no OpenTelemetry).
- We are NOT building a log aggregation pipeline (no Fluentd, no Logstash).
- We are NOT implementing log file rotation (we discuss it but do not build it).

---

## Why Logging Is Harder Than It Looks

Logging seems simple: `console.log(req.method, req.path)`. But production logging involves:
1. **Timing:** When do you log? Before the response? After? During?
2. **Performance:** Does logging block the event loop?
3. **Privacy:** Are you accidentally logging passwords, tokens, or PII?
4. **Storage:** How long do you keep logs? Who has access?
5. **Structure:** Plain text is human-readable but machine-hostile. JSON is machine-friendly but noisy.

```
┌──────────────────────────────────────────────────────────────┐
│  The Logging Pipeline                                        │
│                                                              │
│  Request ──► Route Handler ──► Response Sent ──► Log Event │
│     │              │                  │              │       │
│     │              │                  │              ▼       │
│     │              │                  │       ┌──────────┐   │
│     │              │                  │       │ Redact   │   │
│     │              │                  │       │ sensitive│   │
│     │              │                  │       │ fields   │   │
│     │              │                  │       └────┬─────┘   │
│     │              │                  │            │         │
│     │              │                  │            ▼         │
│     │              │                  │       ┌──────────┐   │
│     │              │                  │       │ Write to │   │
│     │              │                  │       │ stdout   │   │
│     │              │                  │       │ or file  │   │
│     │              │                  │       └──────────┘   │
└──────────────────────────────────────────────────────────────┘
```
