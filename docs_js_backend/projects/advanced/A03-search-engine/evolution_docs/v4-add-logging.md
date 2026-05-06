# v4 — Adding Logging

Your search is slow. You don't know which queries are slow. You don't know which queries users actually run. You're flying blind.

## The Fix: Structured Logging + Performance Tracking

You log every search query with timing.

```ts
import pino from 'pino';
const logger = pino();

app.get('/products', async (req, res) => {
  const start = performance.now();
  const { q, category } = req.query;

  logger.info({ query: q, filters: { category } }, 'Search started');

  const results = await searchProducts(q as string, category as string);

  const duration = performance.now() - start;
  logger.info({
    query: q,
    resultCount: results.length,
    durationMs: duration,
  }, 'Search completed');

  if (duration > 1000) {
    logger.warn({ query: q, durationMs: duration }, 'Slow search query');
  }

  res.json(results);
});
```

Now you can answer:
- What are the top 10 search queries?
- Which queries take > 1 second?
- Which queries return zero results (content gaps)?

## Why This Matters

Without logs, search optimization is guesswork. With structured logs, you can identify slow queries, missing content, and popular searches.

**Next:** Let's write tests so search behavior stays correct as you evolve algorithms.
