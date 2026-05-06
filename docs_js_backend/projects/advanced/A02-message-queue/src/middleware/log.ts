import type { Request, Response, NextFunction } from 'express';

export function logMiddleware(req: Request, _res: Response, next: NextFunction) {
  console.log(`${req.method} ${req.path}`);
  next();
}
