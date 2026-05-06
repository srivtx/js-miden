import express, { Request, Response } from 'express';
import { extractClientIp, analyzeSecurityHeaders, setSecurityHeaders } from './inspector.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(setSecurityHeaders);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/headers', (req: Request, res: Response) => {
  // Sanitize headers by converting to plain object
  const headers: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    headers[key] = value;
  }
  res.json({ headers });
});

app.get('/ip', (req: Request, res: Response) => {
  const result = extractClientIp(req);
  res.json(result);
});

app.get('/security', (req: Request, res: Response) => {
  const analysis = analyzeSecurityHeaders(req);
  res.json(analysis);
});

app.listen(PORT, () => {
  console.log(`M19 Header Inspector running on port ${PORT}`);
});

export default app;
