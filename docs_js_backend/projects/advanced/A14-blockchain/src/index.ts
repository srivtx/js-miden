import express from 'express';
import dotenv from 'dotenv';
import { walletRouter } from './routes/wallet.js';
import { transactionRouter } from './routes/transaction.js';
import { blockRouter } from './routes/block.js';
import { contractRouter } from './routes/contract.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/wallets', walletRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/blocks', blockRouter);
app.use('/api/contracts', contractRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`A14 Blockchain Backend running on port ${PORT}`);
});

export { app, server };
