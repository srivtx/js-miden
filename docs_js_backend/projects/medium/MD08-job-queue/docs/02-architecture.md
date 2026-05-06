# Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │◀───▶│ Express API  │◀───▶│ PostgreSQL  │
│             │     │              │     │             │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐
                    │    Redis     │
                    │   (BullMQ)   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │   Workers    │
                    │  (ffmpeg)    │
                    └──────────────┘
```

## Flow

1. **Create Job**: `POST /api/jobs` with type and payload
2. **Idempotency Check**: If completed job with same payload exists, return cached result
3. **Enqueue**: Job added to BullMQ `video-transcode` queue
4. **Process**: Worker picks up job, spawns `ffmpeg` process
5. **Progress**: Worker updates `progress` column in PostgreSQL periodically
6. **Complete**: On success, store result and mark `completed`
7. **Retry**: On failure, increment `attempt_count` and retry (BullMQ handles scheduling)
8. **DLQ**: After 3 attempts, mark as `dead` and stop retrying

## Worker Concurrency

BullMQ workers run with `concurrency: 2`, meaning each worker process handles 2 jobs simultaneously. Scale by running more worker instances.
