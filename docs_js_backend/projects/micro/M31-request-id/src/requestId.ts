import { Request, Response, NextFunction } from 'express';

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.get('X-Request-ID') || generateRequestId();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

export function getRequestId(req: Request): string {
  return (req as any).requestId || 'unknown';
}
