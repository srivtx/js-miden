# v3 — Adding Validation

A producer just enqueued a job with no `payload`. A consumer dequeued it, tried to process `undefined`, and threw. The job is gone.

```json
{
  "queue": "emails",
  "payload": null
}
```

Your consumer expected an email object with `to`, `subject`, `body`. It got `null`. Crash.

## The Fix: Schema Validation

You validate every enqueue request.

```ts
import { z } from 'zod';

const EnqueueSchema = z.object({
  queue: z.string().min(1).max(100),
  payload: z.record(z.unknown()),
  maxAttempts: z.number().min(1).max(10).optional(),
});

const DequeueSchema = z.object({
  queue: z.string().min(1),
});

app.post('/enqueue/:queue', (req, res) => {
  const parse = EnqueueSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.errors });
  }
  // ...
});
```

Empty queues are rejected. Payloads must be objects. `maxAttempts` is capped at 10.

## Queue Existence Validation

You also validate that consumers don't poll non-existent queues.

```ts
app.post('/dequeue/:queue', (req, res) => {
  if (!queues.has(req.params.queue)) {
    return res.status(404).json({ error: 'Queue not found' });
  }
  // ...
});
```

## The Bug

You validate the body, but what about the queue name in the URL? A producer hits `/enqueue/!!!/`. Your code uses it as a Map key. It works... until someone writes a regex that breaks.

**Fix:** Validate the queue name format.

```ts
const QueueNameSchema = z.string().regex(/^[a-z0-9-]+$/);
const queueName = QueueNameSchema.parse(req.params.queue);
```

**Next:** Let's add logging so you can trace every enqueue, dequeue, and failure.
