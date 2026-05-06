import express, { Request, Response } from 'express';
import { executeWithPool } from './bulkhead.js';

const app = express();
const PORT = process.env.BULKHEAD_PORT || 3000;

app.use(express.json());

app.get('/critical', async (req: Request, res: Response) => {
  try {
    const result = await executeWithPool('critical', async () => {
      // Simulate some work
      await new Promise(r => setTimeout(r, 100));
      return { type: 'critical', status: 'ok' };
    });
    res.json(result);
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
});

app.get('/background', async (req: Request, res: Response) => {
  try {
    const result = await executeWithPool('background', async () => {
      // Simulate some work
      await new Promise(r => setTimeout(r, 100));
      return { type: 'background', status: 'ok' };
    });
    res.json(result);
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Bulkhead Server listening on port ${PORT}`);
  });
}

export { app };
