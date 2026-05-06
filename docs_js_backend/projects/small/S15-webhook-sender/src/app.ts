import express from 'express';
import webhooksRouter from './routes/webhooks.js';

const app = express();
app.use(express.json());
app.use('/api', webhooksRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
