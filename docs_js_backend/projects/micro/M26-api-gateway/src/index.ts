import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from './gateway.js';
import { requestLogger } from './logger.js';

const app = express();
const PORT = process.env.GATEWAY_PORT || 3000;

app.use(express.json());
app.use(requestLogger);

// Proxy routes
app.use('/users', createProxyMiddleware('http://localhost:3001'));
app.use('/orders', createProxyMiddleware('http://localhost:3002'));

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`API Gateway listening on port ${PORT}`);
  });
}

export { app };
