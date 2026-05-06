# Overview

MD08 Distributed Job Queue processes background jobs using BullMQ, Redis, and PostgreSQL. The primary use case is video transcoding to multiple formats with progress tracking and dead letter queue handling.

## Goals

- Accept background job creation via HTTP API
- Process jobs with worker pools using BullMQ
- Track progress persistently in PostgreSQL
- Retry failed jobs up to 3 times, then send to DLQ
- Demonstrate common job queue bugs for educational purposes

## Tech Stack

- Express 5 with TypeScript (ESM)
- BullMQ + Redis for queue and workers
- PostgreSQL for job state persistence
- Vitest + Supertest for testing

## Key Concepts

- **Idempotency**: Duplicate job requests return cached results instead of re-processing
- **Dead Letter Queue (DLQ)**: Permanently failed jobs are moved to a separate state for manual inspection
- **Worker Pools**: Multiple worker processes share the queue for horizontal scaling
- **Zombie Processes**: Child processes not cleaned up when parent crashes
