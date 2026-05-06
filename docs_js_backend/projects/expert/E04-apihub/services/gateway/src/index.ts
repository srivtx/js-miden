import express, { Request, Response } from 'express';
import proxyRoutes from './routes/proxy.js';

const app = express();
app.use(express.json());

app.use('/proxy', proxyRoutes);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'gateway' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Gateway Service running on port ${PORT}`);
});

export default app;
