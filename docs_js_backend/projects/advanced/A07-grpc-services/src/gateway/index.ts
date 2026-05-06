import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import usersRouter from './routes/users.js';
import ordersRouter from './routes/orders.js';
import { errorHandler } from '../middleware/errorHandler.js';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/users', usersRouter);
app.use('/orders', ordersRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

const PORT = process.env.GATEWAY_PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
});
