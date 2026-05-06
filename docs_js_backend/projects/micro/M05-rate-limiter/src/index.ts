import express from 'express';
import { rateLimiter } from './rate-limiter.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint (no rate limiting)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected API endpoint
app.get('/api/data', rateLimiter, (_req, res) => {
  res.json({
    message: 'Here is your data',
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export { app };
