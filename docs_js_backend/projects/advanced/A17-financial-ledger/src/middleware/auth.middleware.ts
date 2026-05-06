import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Simple API key authentication stub.
 */
export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    logger.warn('Missing API key');
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'API key required' } });
    return;
  }

  // In production: validate against database or KMS.
  if (apiKey !== 'ledger-secret-key') {
    logger.warn('Invalid API key');
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid API key' } });
    return;
  }

  (req as any).user = { id: 'system', role: 'admin' };
  next();
}
