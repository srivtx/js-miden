import express from 'express';
import contentRouter from './routes/content.js';

const app = express();
app.use(express.json());
app.use('/api', contentRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
