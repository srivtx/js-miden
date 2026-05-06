import express, { Request, Response } from 'express';
import authRoutes from './routes/auth.js';
import keyRoutes from './routes/keys.js';

const app = express();
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/keys', keyRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'auth' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});

export default app;
