import express, { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from './requestId.js';
import { logger } from './logger.js';
import { proxyMiddleware } from './proxy.js';

const app = express();

app.use(requestIdMiddleware);

app.get('/health', (req: Request, res: Response) => {
  logger.info(req, 'health check');
  res.json({ status: 'ok' });
});

app.get('/data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info(req, 'fetching data');
    if (Math.random() < 0.0001) throw new Error('unlucky');
    res.json({ data: [1, 2, 3] });
  } catch (err) {
    // BUG: In catch blocks, we don't explicitly propagate the request ID to the response.
    // Since requestIdMiddleware runs before the route, res already has X-Request-ID set,
    // BUT if another middleware overrides headers or if we call res.setHeader after this,
    // the error handler might create a new response without it.
    logger.error(req, 'data error');
    next(err);
  }
});

app.get(
  '/proxy',
  proxyMiddleware('http://example.com/api'),
  (req: Request, res: Response) => {
    logger.info(req, 'proxy response');
    res.json({ proxied: true });
  }
);

// Error handler — BUG: does not guarantee X-Request-ID on error responses
// because we don't ensure res has the header if res was not yet started.
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  // Missing: res.getHeader('X-Request-ID') check or re-setting it
  res.status(500).json({ error: err.message });
});

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(3000, () => console.log('M31 listening on :3000'));
}
