import express, { Request, Response } from 'express';
import trackingRoutes from './routes/tracking.js';
import quotaRoutes from './routes/quotas.js';

const app = express();
app.use(express.json());

app.use('/track', trackingRoutes);
app.use('/quotas', quotaRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'usage' });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Usage Service running on port ${PORT}`);
});

export default app;
