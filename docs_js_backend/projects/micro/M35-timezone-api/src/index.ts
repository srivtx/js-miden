import express, { Request, Response } from 'express';
import { convertTime, listTimezones } from './timezone.js';

const app = express();

app.get('/convert', (req: Request, res: Response) => {
  const { from, to, time } = req.query;

  if (!from || !to || !time) {
    res.status(400).json({ error: 'Missing required query parameters: from, to, time' });
    return;
  }

  try {
    const result = convertTime(String(from), String(to), String(time));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/timezones', (_req: Request, res: Response) => {
  res.json({ timezones: listTimezones() });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M35 listening on :3000'));
}
