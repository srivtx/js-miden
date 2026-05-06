# A06 Evolution: v7 — Production Setup

## State of the System

The content moderation pipeline is deployed as a Dockerized, horizontally scalable service with PostgreSQL for durable storage, Redis for the background queue, Prometheus for metrics, and optimistic locking to fix the race condition.

## What Changed

- **Docker + docker-compose.** `Dockerfile` uses `node:20-alpine`. `docker-compose.yml` runs the API, PostgreSQL, and Redis.
- **PostgreSQL storage.** `MemoryStorage` is replaced by `PostgresStorage` using `pg` with parameterized queries. ACID transactions ensure that `updateContent` and `addAuditLog` are atomic.
- **Redis queue.** `QueueJob` objects are serialized to Redis lists. Workers poll `BRPOP` for pending jobs and process `ai_check`, `human_review`, and `publish` asynchronously.
- **Optimistic locking.** `ContentItem` has a `version` field. `humanReview()` uses `UPDATE content SET status = $1, version = version + 1 WHERE id = $2 AND version = $3`. If no rows are updated, the transaction rolls back with `ConflictError`.
- **Prometheus metrics.** `content_submissions_total`, `ai_checks_total`, `human_reviews_total`, `appeals_total`, `pipeline_latency_seconds` histogram.
- **Health checks.** `GET /health` returns `{ status: 'ok', db: 'connected', redis: 'connected' }`. Kubernetes readiness and liveness probes use this endpoint.
- **Rate limiting.** `express-rate-limit` enforces 100 requests per 15 minutes per IP for submissions.
- **Structured logging with Pino.** JSON logs are shipped to stdout and picked up by Fluentd.

## What Still Breaks

- **No real AI integration.** The AI check still uses keyword matching. Integration with OpenAI Moderation API or AWS Comprehend requires API keys and rate limiting.
- **No multi-reviewer consensus.** Borderline content (confidence 0.4–0.6) should require 2+ reviewers, but the system still assigns to one.
- **No event sourcing.** The audit trail is append-only, but state transitions are not stored as immutable events. A rollback requires database restores.
- **No webhook notifications.** Clients must poll for status changes. Webhooks would push updates in real time.

## Code Snapshot (docker-compose.yml)

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/moderation
      - REDIS_URL=redis://redis:6379
      - PORT=3000
    depends_on:
      - postgres
      - redis
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: moderation
  redis:
    image: redis:7-alpine
```

## Architectural Notes

This is the "production" stage. The system now has durable storage, async job processing, and conflict prevention. The race condition is fixed by optimistic locking: if two reviewers act simultaneously, one gets a version mismatch and must retry. The pipeline is observable via Prometheus and structured logs. However, the AI layer is still a mock, and the system lacks advanced features like consensus review and event sourcing.

## Future Work

1. Integrate OpenAI Moderation API with caching and rate limiting.
2. Add consensus review for borderline content (2+ reviewers must agree).
3. Implement event sourcing with Kafka for immutable state transitions.
4. Add webhook notifications for status changes.
