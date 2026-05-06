# 08-CRITIQUE: API Gateway

## WHAT would a senior engineer say?

This project is a **good learning vehicle** and a **bad production system**. It demonstrates the mechanics of HTTP proxying but lacks the resilience, observability, and security required for real-world use.

## WHY is this critique necessary?

Junior engineers often mistake "it works in my test" for "it's production-ready." A senior review highlights the gap between a demo and a system that can survive the internet.

## HOW would a senior engineer fix this?

### 1. Replace Custom Proxy with a Battle-Tested Tool

**Current:** Raw `http.request` with manual piping.
**Critique:** Too easy to miss edge cases (the current bug proves this).
**Fix:** Use `http-proxy-middleware` for learning. Use Envoy, Nginx, or Traefik for production.

### 2. Add Request and Response Size Limits

**Current:** No limit on body size.
**Critique:** A client could upload a 10GB file and exhaust memory.
**Fix:** `app.use(express.json({ limit: '1mb' }));` and validate `Content-Length`.

### 3. Add Rate Limiting

**Current:** Unlimited requests per client.
**Critique:** Vulnerable to DDoS and accidental retry storms.
**Fix:** Use `express-rate-limit` or a Redis-backed rate limiter.

### 4. Add Structured Logging

**Current:** `console.log` with plain text.
**Critique:** Unparsable at scale; no correlation IDs beyond the request ID.
**Fix:** Use Pino or Winston with JSON output and trace context.

### 5. Add Metrics

**Current:** No metrics.
**Critique:** You can't alert on what you can't measure.
**Fix:** Export Prometheus metrics for request count, latency histogram, error rate, and active connections.

### 6. Add Authentication

**Current:** No auth.
**Critique:** Anyone on the internet can hit internal services.
**Fix:** JWT validation at the edge, or delegate to an identity provider (OAuth2/OIDC).

### 7. Fix the Timeout Bug

**Current:** No timeout, no error handling.
**Critique:** This is a P0 outage waiting to happen.
**Fix:** Add `timeout: 5000`, `'timeout'` handler, and `'error'` handler immediately.

## WRONG vs RIGHT

| Aspect | WRONG (Current) | RIGHT (Senior Review) |
|--------|-----------------|-----------------------|
| Proxy implementation | Raw `http.request` | `http-proxy-middleware` or Envoy |
| Body size limit | None | `express.json({ limit: '1mb' })` |
| Rate limiting | None | `express-rate-limit` per IP/API key |
| Logging | `console.log` | Structured JSON with trace IDs |
| Metrics | None | Prometheus + Grafana |
| Authentication | None | JWT or mTLS |
| Timeouts | Missing | Mandatory 5s timeout + 502/504 |

## ASCII Diagram: Production Gateway

```
Internet
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Edge Layer (CDN / WAF)                                      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  API Gateway (Envoy / Nginx)                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │  Auth   │ │Rate Limit│ │  Logs   │ │ Metrics │          │
│  │ (JWT)   │ │(Redis)  │ │ (JSON)  │ │(Prom)   │          │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │
│       └─────────────┴───────────┴───────────┘               │
│                        │                                     │
│                 ┌──────┴──────┐                              │
│                 │   Proxy     │                              │
│                 │  Timeout    │                              │
│                 │  Circuit    │                              │
│                 │  Breaker    │                              │
│                 └──────┬──────┘                              │
└────────────────────────┼─────────────────────────────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          Backend 1  Backend 2  Backend 3
```

## Final Verdict

**Grade: C+ for learning, F for production.**

Use this code to understand how HTTP proxying works. Then delete it and deploy Envoy.
