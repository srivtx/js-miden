# v4 — Adding Logging

A recruiter emails you: "The job I posted yesterday disappeared."

You check the database. It's there. You check the API. It returns. You ask what URL they visited. They don't know. You have no logs.

You spend an hour reproducing their steps. Turns out they filtered by `type=full-time` but their job was `contract`. They thought it disappeared. If you had logs, you'd have seen the exact query parameters and saved an hour.

## The Fix: Structured Logging

You add `pino` and log every request with context.

```ts
import pino from 'pino';
const logger = pino();

// Request logger middleware
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url, query: req.query });
  next();
});

// In filters
app.get('/jobs', (req, res) => {
  const { type, remote, salary_min } = req.query;
  logger.info({ filters: { type, remote, salary_min } }, 'Job filter requested');
  // ...
});
```

Now you can answer questions like:
- "How many people filtered for remote jobs today?"
- "What was the slowest query this hour?"
- "Did someone try to SQL inject us?" (They did. You see it in the logs.)

## Why This Matters

Without logs, debugging production is archaeology. You guess. You hope. With logs, you trace.

**Next:** Let's write tests so we don't deploy broken filters.
