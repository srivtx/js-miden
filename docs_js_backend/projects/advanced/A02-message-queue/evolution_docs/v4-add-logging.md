# v4 — Adding Logging

A consumer reports: "I never got job #12345." You check the server. There's no evidence the job existed. Maybe it was enqueued. Maybe it was dequeued by another consumer. Maybe it failed. You have no idea.

## The Fix: Structured Logging

You log every state change.

```ts
import pino from 'pino';
const logger = pino();

app.post('/enqueue/:queue', (req, res) => {
  const job = createJob(req.body);
  logger.info({ jobId: job.id, queue: job.queue }, 'Job enqueued');
  // ...
});

app.post('/dequeue/:queue', (req, res) => {
  const job = queue.shift();
  if (job) {
    logger.info({ jobId: job.id, queue: job.queue }, 'Job dequeued');
    res.json(job);
  } else {
    logger.debug({ queue: req.params.queue }, 'Queue empty, no job dequeued');
    res.status(204).send();
  }
});

// Consumer callback
function onJobComplete(jobId: string, success: boolean, error?: string) {
  if (success) {
    logger.info({ jobId }, 'Job completed successfully');
  } else {
    logger.error({ jobId, error }, 'Job failed');
  }
}
```

Now you can trace: enqueued → dequeued → completed/failed.

## Why This Matters

Without logs, a missing job is a mystery. With structured logs, you can query the lifecycle of any job ID in seconds.

**Next:** Let's write tests so queue invariants hold as you add persistence.
