# MD08 Distributed Job Queue — v1 Simple JS

> **Motto**: Queue in memory before you queue in Redis.

## What We Built

A single-file Express app in JavaScript with an in-memory array as the job queue. One route: `POST /jobs` pushes a job object into the array. A `setInterval` worker pops jobs and processes them. No persistence. No retries. No DLQ.

## Why Start Here

- **Speed**: See a job processed in 20 lines
- **Clarity**: Understand the queue abstraction without BullMQ complexity
- **Baseline**: Every later feature (Redis, BullMQ, retries) must justify its ops cost

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│  Express (JS)   │─────▶│  In-Memory      │
│  (Uploader) │◀─────│  /jobs          │◀─────│  Array          │
└─────────────┘      └─────────────────┘      └─────────────────┘
                                                      │
                                                      ▼
                                               ┌──────────────┐
                                               │  setInterval │
                                               │  Worker      │
                                               └──────────────┘
```

## Code

```javascript
// server.js
const express = require('express');

const app = express();
app.use(express.json());

const jobs = [];
const JOB_STATUSES = { PENDING: 'pending', PROCESSING: 'processing', COMPLETED: 'completed', FAILED: 'failed' };

app.post('/jobs', (req, res) => {
  const job = {
    id: Math.random().toString(36).slice(2),
    type: req.body.type,
    payload: req.body.payload,
    status: JOB_STATUSES.PENDING,
    createdAt: new Date(),
  };
  jobs.push(job);
  res.status(202).json({ jobId: job.id, status: job.status });
});

app.get('/jobs/:id', (req, res) => {
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// In-memory worker
setInterval(async () => {
  const job = jobs.find(j => j.status === JOB_STATUSES.PENDING);
  if (!job) return;

  job.status = JOB_STATUSES.PROCESSING;
  try {
    await processJob(job);
    job.status = JOB_STATUSES.COMPLETED;
  } catch (err) {
    console.error('Job failed:', err);
    job.status = JOB_STATUSES.FAILED;
  }
}, 1000);

async function processJob(job) {
  console.log('Processing', job.type, job.payload);
  await new Promise(r => setTimeout(r, 500)); // simulate work
}

app.listen(3000, () => console.log('Job Queue v1 on :3000'));
```

## Problems We Accepted

- No persistence — restart the server, lose all jobs
- No retries — a failed job stays failed forever
- No DLQ — permanently failed jobs have no home
- No idempotency — submitting the same job twice creates duplicates
- No concurrency — one job at a time
- No logging — `console.log` only
- No tests — we hope it works

## Checklist

- [ ] Jobs are stored in a JavaScript array
- [ ] Worker polls with `setInterval`
- [ ] No Redis or database dependency
- [ ] Job status is mutated in-place (no immutability)

## Next Step

Add TypeScript so we stop guessing what `job.payload` contains.
