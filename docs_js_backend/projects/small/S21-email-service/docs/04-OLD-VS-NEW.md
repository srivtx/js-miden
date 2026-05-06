# 04-OLD-VS-NEW.md

## 2015 Approach (Naive / Synchronous)

### Architecture
- Express route handler calls SMTP directly
- No queue, no worker, no retry
- Templates hardcoded as string concatenation
- No idempotency keys

### Code Pattern
```typescript
// 2015-style: Blocking, fragile, unmaintainable
app.post('/send', async (req, res) => {
  const { to, subject, body } = req.body;
  
  // BLOCKS for 500ms+
  const info = await transporter.sendMail({ to, subject, body });
  
  res.json({ messageId: info.messageId });
});
```

### Problems
- 10 concurrent emails = 10 blocked threads (or event loop stalls in Node)
- No record of attempted sends
- Bounce handling: parse Postfix logs manually
- Template changes: deploy new code

---

## 2025 Approach (Async / Queue-Based)

### Architecture
- Express returns 202 immediately
- Redis/BullMQ queue persists jobs
- Worker processes queue independently
- Exponential backoff retry
- Webhook bounce handling
- Template service with versioning

### Code Pattern
```typescript
// 2025-style: Non-blocking, durable, observable
app.post('/send', async (req, res) => {
  const job = await emailQueue.add('send', req.body, {
    jobId: req.body.idempotencyKey,  // Deduplication
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 }
  });
  
  res.status(202).json({ jobId: job.id, status: 'queued' });
});

// Worker (separate process)
worker.on('completed', (job) => {
  metrics.increment('email.sent');
});

worker.on('failed', (job, err) => {
  if (job.attemptsMade >= 3) {
    alertOps(`Permanent bounce: ${job.data.to}`);
  }
});
```

### Advantages
- HTTP latency: 500ms → 5ms
- Throughput: 10/s → 10,000/s (queue absorbs bursts)
- Reliability: 0% retry → 95%+ recovery from transient failures
- Observability: zero visibility → full job lifecycle tracking
- Maintainability: deploy to fix typo → edit template in CMS

## ASCII: Timeline Comparison

```
2015 (Synchronous)                          2025 (Asynchronous)
==================                          ====================

Req: POST /send                             Req: POST /send
 |                                             |
 |--smtp-send(500ms)                          |--queue.add(5ms)
 |                                             |
 |--smtp-send(500ms)                          |--queue.add(5ms)
 |                                             |
 |--smtp-send(500ms)                          |--queue.add(5ms)
 |                                             |
 v                                             v
Res: 200 (1500ms total)                     Res: 202 (5ms each)
                                              |
                                              |--worker process
                                              |   (independent)
                                              v
                                           SMTP sends
                                           (batched/parallel)
```
