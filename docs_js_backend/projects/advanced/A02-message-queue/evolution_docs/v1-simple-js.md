# v1 — The Naive Queue (Pure JS)

You need a message queue. Producers push jobs. Consumers pop them.

```js
const express = require('express');
const app = express();
app.use(express.json());

const queues = new Map();

app.post('/enqueue/:queue', (req, res) => {
  const { queue } = req.params;
  if (!queues.has(queue)) queues.set(queue, []);
  queues.get(queue).push(req.body);
  res.json({ status: 'enqueued' });
});

app.post('/dequeue/:queue', (req, res) => {
  const queue = queues.get(req.params.queue);
  if (!queue || queue.length === 0) {
    return res.status(204).send();
  }
  const job = queue.shift();
  res.json(job);
});

app.listen(3000);
```

You POST a job. You GET a job. Simple.

## Then the Pain Hits

**Process restart = data loss.** You deploy a fix. The queue is in memory. Every unprocessed job vanishes.

**No acknowledgement.** A consumer dequeues a job, crashes while processing it. The job is gone forever. Lost.

**No retry.** A job fails because a downstream API is temporarily down. It's thrown away. No second chance.

**One queue type.** You need a high-priority queue and a low-priority queue. You fork the array logic. Duplicated code everywhere.

## The Realization

You need:
1. **Persistence** — jobs survive restarts
2. **Acknowledgement** — jobs aren't lost on consumer crash
3. **Retries** — failed jobs get another chance
4. **Separation of concerns** — queue storage vs queue logic

But this is a monolith. Every queue lives in one process. The evolution will force you to externalize storage and split responsibilities.
