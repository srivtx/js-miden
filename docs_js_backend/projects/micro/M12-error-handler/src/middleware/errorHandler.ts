import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors.js';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // BUG 1: Does not check res.headersSent. If headers were already sent,
  // calling res.status() below will crash with ERR_HTTP_HEADERS_SENT.

  console.error('[Error]', err.message);

  const isAppError = err instanceof AppError;

  const problem = {
    type: isAppError ? err.type : 'about:blank',
    title: isAppError ? err.title : 'Internal Server Error',
    status: isAppError ? err.status : 500,
    detail: err.message,
    instance: req.originalUrl,
    // BUG 2: Exposes stack trace in all environments, including production.
    // This leaks internal implementation details to potential attackers.
    stack: err.stack,
  };

  // If headers were already sent, this line crashes the process.
  res.status(problem.status).json(problem);
}
