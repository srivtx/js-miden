import express, { Request, Response } from 'express';
import { uuidV4, uuidV7, ulid, bulkGenerate } from './uuid.js';

const app = express();
app.use(express.json());

app.get('/uuid/v4', (_req: Request, res: Response) => {
  res.json({ uuid: uuidV4() });
});

app.get('/uuid/v7', (_req: Request, res: Response) => {
  res.json({ uuid: uuidV7() });
});

app.get('/uuid/ulid', (_req: Request, res: Response) => {
  res.json({ ulid: ulid() });
});

app.post('/uuid/bulk', (req: Request, res: Response) => {
  const { count = 1, type = 'v4' } = req.body;
  const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 1000);
  const results = bulkGenerate(n, type as 'v4' | 'v7' | 'ulid');
  res.json({ count: n, type, results });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M33 listening on :3000'));
}
