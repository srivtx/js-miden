# MD03: URL Shortener Pro — Project Overview

## Abstract

This project implements a high-performance, analytics-rich URL shortening service. Unlike basic shorteners, it supports custom aliases, real-time click analytics, rate limiting, and collision-resistant hash generation at scale. It must handle millions of shortenings and redirects per day with sub-millisecond latency for reads.

## System Context

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────────┐
│   Client     │────▶│  API Gateway │────▶│  Shortener Service  │
│ (Web/Mobile) │◄────│   (Rate      │◄────│  (Node.js/Go)       │
└──────────────┘     │   Limiting)  │     └─────────────────────┘
                     └──────────────┘              │
                                                   ▼
                     ┌──────────────┐     ┌─────────────────────┐
                     │  Analytics   │◄────│  PostgreSQL (URLs)  │
                     │   Pipeline   │     │  Redis (Cache)      │
                     │  (Kafka/     │     │  ClickHouse (Stats) │
                     │   Flink)     │     └─────────────────────┘
                     └──────────────┘              │
                                                   ▼
                                          ┌─────────────────────┐
                                          │  Bloom Filter       │
                                          │  (Collision Check)  │
                                          └─────────────────────┘
```

## Functional Requirements

1. **Shorten URL**: Accept a long URL, return a short code.
2. **Custom Aliases**: Allow users to request specific short codes (e.g., `bit.ly/sale2024`).
3. **Redirect**: Fast 301/302 redirect from short code to long URL.
4. **Analytics**: Track clicks by geography, device, referrer, time.
5. **Expiration**: Support TTL on short links.
6. **Rate Limiting**: Prevent abuse (spam, DDoS).

## Non-Functional Requirements

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Redirect Latency | < 10ms p99 | Every millisecond costs engagement |
| Shorten Latency | < 100ms | Acceptable for API call |
| Throughput | 100K redirects/sec | Viral content spikes |
| Collision Rate | < 0.001% | Must be astronomically unlikely |
| Availability | 99.99% | Downtime breaks all shared links |

## CAP Theorem Positioning

A URL shortener is primarily an **AP** system for redirects (eventual consistency of analytics is fine), but the **shortening** operation must be **CP** to prevent duplicate codes.

- **Shorten (CP)**: If two users simultaneously try to claim `bit.ly/sale`, one must win and one must fail.
- **Redirect (AP)**: A slightly stale cache hit is acceptable; the URL mapping rarely changes.
- **Analytics (AP)**: Click counts are eventually consistent by nature.

> "The URL shortener is a write-rarely, read-heavily workload. The CAP trade-off should favor availability for reads and consistency for writes." — Adapted from Dynamo design principles.

## Key Algorithms and Data Structures

| Component | Technology | Purpose |
|-----------|------------|---------|
| Code Generation | Base62 encoding | Short, URL-safe identifiers |
| Collision Avoidance | Hash + Counter | Unique code generation |
| Cache | Redis | Sub-millisecond redirects |
| Analytics | ClickHouse / Kafka | High-throughput aggregation |
| Abuse Prevention | Token Bucket + Bloom Filter | Rate limiting and existence checks |

## Data Model (Simplified)

```sql
CREATE TABLE urls (
    id BIGSERIAL PRIMARY KEY,
    short_code VARCHAR(20) UNIQUE NOT NULL,
    long_url TEXT NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    click_count BIGINT DEFAULT 0
);

CREATE INDEX idx_urls_short_code ON urls(short_code);
```

## Reference Architecture

This design draws from:
- **bit.ly** — The pioneer of analytics-driven short URLs.
- **Twitter t.co** — High-volume, safety-focused redirector.
- **MD5/SHA papers** (Rivest, 1992; NIST, 2015) — Hash function foundations.
- **Bloom (1970)** — Space-efficient probabilistic data structures.

## Files in this Documentation

1. `overview.md` — This file
2. `base62-encoding.md` — Base62 math and implementation
3. `hash-collisions.md` — Collision handling and uniqueness guarantees
4. `distributed-counters.md` — High-throughput click counting
5. `caching-strategies.md` — Redis and CDN caching
6. `analytics-aggregation.md` — Real-time and batch analytics
7. `rate-limiting.md` — Abuse prevention patterns
8. `bloom-filters.md` — Probabilistic existence checks
9. `theory-and-citations.md` — Deeper theory and bibliography
