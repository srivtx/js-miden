import express from 'express';
import metricsRouter from './routes/metrics.js';
import scalingRouter from './routes/scaling.js';
import optimizerRouter from './routes/optimizer.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/metrics', metricsRouter);
  app.use('/scaling', scalingRouter);
  app.use('/optimize', optimizerRouter);
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  return app;
}
