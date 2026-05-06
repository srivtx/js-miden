# v1 — The Naive Job Board (Pure JS)

You need a job board. Fast. You spin up Express and start hacking.

```js
const express = require('express');
const app = express();

const jobs = [
  { id: 1, title: 'Frontend Dev', company: 'Acme', salary: 80000 },
];

app.get('/jobs', (_req, res) => res.json(jobs));
app.post('/jobs', (req, res) => {
  jobs.push({ id: jobs.length + 1, ...req.body });
  res.status(201).json(jobs[jobs.length - 1]);
});

app.listen(3000);
```

It works. You even made a static HTML page that fetches from it. Beautiful.

## Then the Pain Hits

**The salary is wrong.** You stored `99.99` as a number. In JavaScript, that's actually `99.98999999999999`. A candidate filters for `$99,990+` and this job doesn't show up because `99.989999... < 99.99`.

**The filter is broken.** A user wants remote jobs only. You have no filtering. They have to scroll through 500 listings.

**Sorting?** What's sorting? The jobs are in insertion order. The newest job is at the bottom. Users are confused.

## The Realization

A static list of jobs isn't enough. You need:
1. **CRUD** — create, read, update, delete
2. **Filtering** — by type, location, remote, salary range
3. **Sorting** — by date, salary
4. **Proper money handling** — because floats lie

This is where the evolution starts.
