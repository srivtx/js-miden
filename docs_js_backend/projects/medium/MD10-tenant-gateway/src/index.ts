import express from 'express';
import dotenv from 'dotenv';
import { tenantsRouter } from './routes/tenants.js';
import { gatewayRouter } from './routes/gateway.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/tenants', tenantsRouter);
app.use('/api/gateway', gatewayRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MD10 Tenant Gateway running on port ${PORT}`);
});

export { app };
