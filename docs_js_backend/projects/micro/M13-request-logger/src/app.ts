import express from 'express';
import { requestLogger } from './middleware/logger.js';

const app = express();

app.use(express.json());
app.use(requestLogger);

app.post('/login', (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (username === 'admin' && password === 'secret') {
    res.json({ token: 'fake-jwt' });
    return;
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
