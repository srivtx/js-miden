import express, { Request, Response } from 'express';
import { getCurrentTime, convertTime, isValidTimeZone } from './timezone.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/time/:timezone', (req: Request, res: Response) => {
  try {
    const zone = req.params.timezone;
    if (!isValidTimeZone(zone)) {
      res.status(400).json({ error: 'Invalid timezone' });
      return;
    }
    const result = getCurrentTime(zone);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/convert', (req: Request, res: Response) => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;
    const time = req.query.time as string;

    if (!from || !to || !time) {
      res.status(400).json({ error: 'Missing from, to, or time query parameter' });
      return;
    }

    if (!isValidTimeZone(from) || !isValidTimeZone(to)) {
      res.status(400).json({ error: 'Invalid timezone' });
      return;
    }

    const result = convertTime(from, to, time);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`M18 Timezone API running on port ${PORT}`);
});

export default app;
