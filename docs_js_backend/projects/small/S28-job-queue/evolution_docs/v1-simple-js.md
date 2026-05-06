# v1-simple-js

## Goal
Execute background work using `setTimeout`.

## Code

```js
// src/index.js
const express = require('express');
const app = express();
app.use(express.json());

const jobs = new Map();
let id = 0;

app.post('/jobs', (req, res) => {
  const jobId = `${++id}`;
  jobs.set(jobId, { status: 'pending', result: null });

  setTimeout(() => {
    jobs.set(jobId, { status: 'completed', result: 'done' });
  }, 1000);

  res.json({ id: jobId, status: 'pending' });
});

app.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  res.json(job);
});

app.listen(3000, () => console.log('Queue on 3000'));
```

## Decisions
- `setTimeout` — zero dependencies, simplest scheduling.
- In-memory `Map` for job state.

## Risks
- Process crash = lost jobs.
- No retry — failures are permanent.
- No concurrency control — all jobs run simultaneously.
- No visibility into progress.
