# Phases

## Phase 1: MVP

- [x] `POST /jobs` to create transcode jobs
- [x] BullMQ worker processes jobs
- [x] Progress tracking in PostgreSQL
- [x] Retry failed jobs
- [x] Dead letter queue after 3 failures

## Phase 2: Enhancements

- [x] Idempotency (return cached result for duplicates)
- [x] Worker pool with concurrency limit
- [x] Progress polling endpoint
- [x] Graceful error handling with attempt counting

## Phase 3: Advanced

- [ ] Job priorities (high/normal/low)
- [ ] Scheduled jobs (process at specific time)
- [ ] Job cancellation API
- [ ] Worker auto-scaling based on queue depth
- [ ] Persistent dead letter inspection UI
- [ ] Job result caching with TTL

## Known Bugs (Intentional)

1. **No idempotency**: `/jobs-no-idempotency` re-processes completed jobs
2. **Zombie processes**: `transcodeVideoNoCleanup` leaves child processes on crash
3. **No DLQ**: Without proper attempt tracking, failed jobs disappear forever
