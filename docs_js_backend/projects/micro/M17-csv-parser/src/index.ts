import express, { Request, Response } from 'express';
import { parseCsvSafe } from './parser.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Upload CSV
app.post('/upload-csv', async (req: Request, res: Response) => {
  try {
    // For this micro project we accept raw text body as CSV
    // In production use multer for multipart uploads
    const csvText = req.body.csv || '';
    const requiredHeaders = (req.body.requiredHeaders as string | undefined)?.split(',').filter(Boolean) || [];
    const maxRows = Number(req.body.maxRows) || 10000;

    const result = parseCsvSafe(csvText, { requiredHeaders, maxRows });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`M17 CSV Parser API running on port ${PORT}`);
});

export default app;
