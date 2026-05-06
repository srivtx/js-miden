import express, { Request, Response } from 'express';
import apiRoutes from './routes/apis.js';
import subscriptionRoutes from './routes/subscriptions.js';
import webhookRoutes from './routes/webhooks.js';

const app = express();
app.use(express.json());

app.use('/apis', apiRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/webhooks', webhookRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'developer-portal' });
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Developer Portal Service running on port ${PORT}`);
});

export default app;
