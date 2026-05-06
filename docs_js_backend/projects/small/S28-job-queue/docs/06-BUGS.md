# 06-BUGS

## Intentional Bug: Jobs Not Marked as Failed on Timeout

### Description
The BullMQ worker does not set a job timeout. If a processor hangs (e.g., infinite loop, deadlocked resource, stuck network call), the job stays in `active` state forever, blocking a worker slot.

### Location
`src/services/queue.ts`:
```typescript
const worker = new Worker('jobQueue', async (job: Job) => {
  // BUG: no timeout handling
  switch (job.data.type) { ... }
}, { connection: redis });
```

### Real-World Impact
- Worker pool exhaustion: all workers eventually hang.
- Queue throughput drops to zero.
- No alerting because jobs never fail; monitoring sees "all jobs active" but no progress.
- Data export jobs that hang leave partial files or locks in downstream systems.

### Fix
Use BullMQ's built-in timeout or wrap processors in a Promise.race:
```typescript
const worker = new Worker('jobQueue', async (job: Job) => {
  const timeout = 30000;
  return await Promise.race([
    processor(job),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
  ]);
}, { connection: redis, lockDuration: 30000 });
```
