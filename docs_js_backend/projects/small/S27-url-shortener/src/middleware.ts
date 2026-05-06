import { Request, Response, NextFunction } from 'express';

// No custom middleware for shortener beyond rate limiter in routes
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
