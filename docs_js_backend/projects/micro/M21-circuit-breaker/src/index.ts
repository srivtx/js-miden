import express from 'express';
import { CircuitBreaker } from './circuit-breaker.js';

const app = express();
app.use(express.json());

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  failureWindowMs: 60000,
  halfOpenTimeoutMs: 30000,
  timeoutMs: 5000,
});

// Simulated external API
let shouldFail = false;

app.post('/simulate/fail', (req, res) => {
  shouldFail = req.body.fail ?? true;
  res.json({ shouldFail });
});

app.get('/api/external', async (req, res) => {
  try {
    const result = await breaker.execute(async () => {
      if (shouldFail) {
        throw new Error('External API error');
      }
      return { data: 'success', timestamp: Date.now() };
    });
    res.json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message, circuitState: breaker.getState() });
  }
});

app.get('/health', (req, res) => {
  res.json({ state: breaker.getState(), metrics: breaker.getMetrics() });
});

export { app, breaker };

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Circuit breaker service running on port ${PORT}`);
  });
}
