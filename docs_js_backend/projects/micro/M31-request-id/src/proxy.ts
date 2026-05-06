import { Request, Response, NextFunction } from 'express';
import { getRequestId } from './requestId.js';

export function proxyMiddleware(
  downstreamUrl: string
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const requestId = getRequestId(req);
      const headers = new Headers();
      headers.set('X-Request-ID', requestId);
      // Simulate downstream call
      await fetch(downstreamUrl, { headers });
      next();
    } catch (err) {
      next(err);
    }
  };
}
