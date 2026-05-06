import express from 'express';
import { increment, getCount } from './counter.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/increment', async (_req, res) => {
  try {
    const count = await increment();
    res.json({ count });
  } catch (_err) {
    res.status(503).json({ error: 'Redis unavailable' });
  }
});

app.get('/count', async (_req, res) => {
  try {
    const count = await getCount();
    res.json({ count });
  } catch (_err) {
    res.status(503).json({ error: 'Redis unavailable' });
  }
});

app.listen(PORT, () => {
  console.log(`Counter API listening on port ${PORT}`);
});
