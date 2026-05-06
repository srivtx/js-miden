# S28 Job Queue

Background job queue with BullMQ/Redis supporting retries, dead letter queue, progress tracking, and cancellation.

## Features

- Job types: email, image processing, data export
- Retry with exponential backoff
- Dead letter queue for permanently failed jobs
- Job progress tracking and cancellation

## Intentional Bug

Jobs that timeout are never marked as failed, causing them to hang forever and block workers.

## Scripts

```bash
npm run dev       # Start development server
npm test          # Run Vitest tests (includes bug reproduction)
npm run build     # Compile TypeScript
```

## Docker

```bash
docker-compose up -d
```
