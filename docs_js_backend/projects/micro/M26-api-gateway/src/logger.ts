import { Request, Response, NextFunction } from 'express';
import http from 'http';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] || 'unknown';
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} | RequestID: ${requestId}`);
  next();
}
