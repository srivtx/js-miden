import express from 'express';
import searchRouter from './routes/search.js';

const app = express();
app.use(express.json());
app.use('/api', searchRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
