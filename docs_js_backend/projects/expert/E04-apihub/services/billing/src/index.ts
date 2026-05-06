import express, { Request, Response } from 'express';
import invoiceRoutes from './routes/invoices.js';
import tierRoutes from './routes/tiers.js';

const app = express();
app.use(express.json());

app.use('/invoices', invoiceRoutes);
app.use('/tiers', tierRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'billing' });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Billing Service running on port ${PORT}`);
});

export default app;
