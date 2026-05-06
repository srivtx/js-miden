import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types.js';

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Internal Server Error';

  console.error(`[Error] ${code}: ${message}`, err.stack);

  res.status(statusCode).json({
    error: {
      code,
      message: process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal Server Error'
        : message,
    },
  });
}
