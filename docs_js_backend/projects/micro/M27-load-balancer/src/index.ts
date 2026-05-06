import express, { Request, Response } from 'express';
import { selectBackend } from './balancer.js';
import http from 'http';

const app = express();
const PORT = process.env.LB_PORT || 3000;

app.use(express.json());

app.all('*', async (req: Request, res: Response) => {
  const backend = selectBackend();
  if (!backend) {
    return res.status(503).json({ error: 'No backends available' });
  }

  const options = {
    hostname: 'localhost',
    port: backend.port,
    path: req.path,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode || 200);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.status(502).json({ error: 'Bad Gateway', message: err.message });
  });

  req.pipe(proxyReq);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Load Balancer listening on port ${PORT}`);
  });
}

export { app };
