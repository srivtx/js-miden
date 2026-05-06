import express, { Request, Response } from 'express';
import metricsRoutes from './routes/metrics.js';

const app = express();
app.use(express.json());

app.use('/metrics', metricsRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'analytics' });
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`Analytics Service running on port ${PORT}`);
});

export default app;
