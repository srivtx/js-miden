# v2 — Adding TypeScript

You just debugged why a consumer received `{ "payload": undefined }`.

```js
const job = queue.shift();
res.json(job);
```

The producer sent `{ "data": { ... } }`. The consumer expected `{ "payload": { ... } }`. No types means no contract. TypeScript fixes this.

## The Fix: Types

```ts
interface Job<T = unknown> {
  id: string;
  queue: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

interface EnqueueRequest<T = unknown> {
  queue: string;
  payload: T;
  maxAttempts?: number;
}

app.post('/enqueue/:queue', (req, res) => {
  const body: EnqueueRequest = req.body;
  const job: Job = {
    id: crypto.randomUUID(),
    queue: req.params.queue,
    payload: body.payload,
    attempts: 0,
    maxAttempts: body.maxAttempts ?? 3,
    createdAt: new Date(),
  };
  // ...
});
```

Now producer and consumer agree on the shape of a `Job`. `payload` is always `payload`. No more `data` vs `payload` confusion.

## But Wait...

TypeScript doesn't persist jobs to disk. It doesn't add acknowledgements. It just makes the contract explicit.

**Next:** Let's add validation so malformed jobs are rejected at the gate.
