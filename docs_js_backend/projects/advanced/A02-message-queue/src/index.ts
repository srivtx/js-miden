import express from 'express';
import dotenv from 'dotenv';
import { queuesRouter } from './routes/queues.js';
import { topicsRouter } from './routes/topics.js';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/api/queues', queuesRouter);
app.use('/api/topics', topicsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', messages: getQueueStats() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`A02 Message Queue running on port ${PORT}`);
});

function getQueueStats() {
  return { note: 'See individual queue endpoints for stats' };
}

export { app };
