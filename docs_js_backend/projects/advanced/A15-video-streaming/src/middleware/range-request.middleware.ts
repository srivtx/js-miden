import { Request, Response, NextFunction } from 'express';
import { parseRange } from '../utils/range.utils.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to parse and attach range info to request.
 * BUG: Does not validate against actual file size at this stage.
 */
export function rangeRequest(req: Request, res: Response, next: NextFunction): void {
  const rangeHeader = req.headers.range as string | undefined;
  if (rangeHeader) {
    // BUG: parseRange called with dummy fileSize=0 because actual size is unknown here.
    // This allows any range format to pass through.
    const range = parseRange(rangeHeader, 0);
    if (range) {
      (req as any).range = range;
      logger.debug({ range }, 'Range request parsed');
    }
  }
  next();
}
