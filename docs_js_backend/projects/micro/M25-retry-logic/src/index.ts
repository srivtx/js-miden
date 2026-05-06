import express from 'express';
import { RetryClient } from './retry-logic.js';

const app = express();
app.use(express.json());

const client = new RetryClient({
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 16000,
  timeoutMs: 5000,
});

app.get('/fetch', async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'URL query parameter required' });
    return;
  }

  try {
    const start = Date.now();
    const result = await client.fetch(url);
    const duration = Date.now() - start;

    res.json({
      url,
      status: result.status,
      data: result.data.slice(0, 1000),
      durationMs: duration,
    });
  } catch (error: any) {
    res.status(502).json({
      url,
      error: error.message,
      retriesExhausted: true,
    });
  }
});

export { app, client };

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Retry logic service running on port ${PORT}`);
  });
}
