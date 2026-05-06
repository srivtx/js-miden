import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import subscriptionRoutes from './routes/subscriptions.js';
import invoiceRoutes from './routes/invoices.js';
import webhookRoutes from './routes/webhooks.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3006;

// Raw body for Stripe webhook signature verification
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/webhooks', webhookRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Billing Engine API running on port ${PORT}`);
});

export default app;
