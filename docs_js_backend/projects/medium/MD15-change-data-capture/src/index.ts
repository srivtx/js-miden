import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import usersRouter from './routes/users.js';
import ordersRouter from './routes/orders.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initDb } from './services/db.js';

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

const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`CDC API running on port ${PORT}`);
  });
});
