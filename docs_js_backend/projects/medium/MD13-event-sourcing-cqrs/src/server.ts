import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { config } from './config/index.js';
import { orderRouter } from './controllers/order-controller.js';

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/orders', orderRouter);

app.listen(config.port, () => {
  console.log(`🛒 CQRS server ready at http://localhost:${config.port}`);
});

export { app };