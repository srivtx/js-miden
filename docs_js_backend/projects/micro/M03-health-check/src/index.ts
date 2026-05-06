import express from 'express';
import { checkHealth } from './health.js';

export const app = express();

app.get('/health', async (_req, res) => {
  try {
    const health = await checkHealth();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (_error) {
    res.status(503).json({
      status: 'unhealthy',
      checks: {
        database: 'unknown',
        redis: 'unknown',
      },
    });
  }
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
