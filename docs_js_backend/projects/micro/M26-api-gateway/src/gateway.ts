import { Request, Response, NextFunction } from 'express';
import http from 'http';
import { randomUUID } from 'crypto';

export function createProxyMiddleware(targetUrl: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-ID', requestId);
    req.headers['x-request-id'] = requestId;

    const url = new URL(targetUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: req.path,
      method: req.method,
      headers: req.headers,
      // BUG: No timeout set! Slow backends will hang forever.
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.status(proxyRes.statusCode || 200);
      Object.keys(proxyRes.headers).forEach((key) => {
        res.setHeader(key, proxyRes.headers[key]!);
      });
      proxyRes.pipe(res);
    });

    // BUG: No error handling! If backend is down, the gateway crashes.
    // proxyReq.on('error', ...);

    req.pipe(proxyReq);
  };
}
