import { Request } from 'express';
import { getRequestId } from './requestId.js';

export interface LogEntry {
  timestamp: string;
  level: string;
  requestId: string;
  message: string;
  meta?: Record<string, unknown>;
}

export function logWithRequestId(
  req: Request,
  level: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    requestId: getRequestId(req),
    message,
    meta,
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (req: Request, message: string, meta?: Record<string, unknown>) =>
    logWithRequestId(req, 'INFO', message, meta),
  error: (req: Request, message: string, meta?: Record<string, unknown>) =>
    logWithRequestId(req, 'ERROR', message, meta),
};
