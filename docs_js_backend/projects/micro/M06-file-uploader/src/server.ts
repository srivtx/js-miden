import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import uploadRouter from './routes/upload.js';

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.use('/upload', uploadRouter);

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Max 5MB.' });
    }
  }
  res.status(400).json({ error: err?.message || 'Upload failed' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`M06 server running on http://localhost:${PORT}`);
  });
}

export default app;
