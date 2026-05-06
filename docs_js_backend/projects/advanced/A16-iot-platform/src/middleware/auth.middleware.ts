import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Authentication middleware stub.
 * BUG: Does not verify device credentials or JWT tokens.
 * Any client can impersonate any device by providing a deviceId.
 */
export function authenticateDevice(req: Request, res: Response, next: NextFunction): void {
  const deviceId = req.headers['x-device-id'] as string || req.body?.deviceId || req.params?.deviceId;

  if (!deviceId) {
    logger.warn('Missing device ID');
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Device ID required' } });
    return;
  }

  // BUG: No actual authentication. We simply trust the provided deviceId.
  (req as any).deviceId = deviceId;
  logger.debug({ deviceId }, 'Device authenticated (stub)');

  next();
}

/**
 * Admin authentication stub.
 * BUG: No actual admin verification.
 */
export function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;

  // BUG: Hardcoded key and no role verification.
  if (apiKey !== 'admin-secret') {
    logger.warn('Invalid admin API key');
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    return;
  }

  next();
}
