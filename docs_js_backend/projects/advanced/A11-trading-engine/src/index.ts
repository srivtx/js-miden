import express from 'express';
import dotenv from 'dotenv';
import { ordersRouter } from './routes/orders.js';
import { tradesRouter } from './routes/trades.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/orders', ordersRouter);
app.use('/api/trades', tradesRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`A11 Trading Engine running on port ${PORT}`);
});

export { app, server };
