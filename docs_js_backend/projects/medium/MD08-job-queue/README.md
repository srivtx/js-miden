# MD08: Distributed Job Queue

Background job processing with BullMQ, worker pools, progress tracking, retry logic, and dead letter queue.

## Features

- **Phase 1**: Upload video → transcode to multiple formats, track progress, retry failed jobs, DLQ after 3 failures
- **Phase 2-3**: Worker pools, job priorities, idempotency, progress tracking
- **Intentional Bugs**:
  - `/jobs-no-idempotency` re-processes duplicates
  - `transcodeVideoNoCleanup` leaves zombie ffmpeg processes
  - Missing DLQ (documented in comparison routes)

## Quick Start

```bash
cp .env.example .env
npm install
npm run db:up
npm run dev      # API server
npm run dev:worker # Background worker
```

## Testing

```bash
npm test
```

## Project Structure

```
src/
  index.ts              # API entry point
  worker.ts             # BullMQ worker entry point
  app.ts                # Express app setup
  db.ts                 # PostgreSQL connection
  queue.ts              # BullMQ queue & worker factory
  routes/
    jobs.ts             # Job creation & status routes
  services/
    transcode.ts        # FFmpeg wrapper with cleanup
  types.ts              # Shared types
tests/
  jobs.test.ts          # Vitest + Supertest suite
docs/
  01-overview.md
  ...
```
