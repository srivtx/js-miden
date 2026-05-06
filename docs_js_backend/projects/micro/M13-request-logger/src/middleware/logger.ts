import type { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    // BUG: Logs the entire request body without redacting sensitive fields.
    // If a user submits a password, it ends up in plain text in the logs.
    console.log(
      JSON.stringify({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        userAgent: req.headers['user-agent'],
        body: req.body,
      })
    );
  });

  next();
}
