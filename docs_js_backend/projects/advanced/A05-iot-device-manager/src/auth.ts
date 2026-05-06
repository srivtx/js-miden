import { Request, Response, NextFunction } from 'express';
import { storage } from './storage.js';

export async function authenticateDevice(req: Request, res: Response, next: NextFunction) {
  // PHASE 2-3: In production, use X.509 certificates or JWT tokens
  // BUG: Current implementation only checks header presence, not validity
  const deviceId = req.headers['x-device-id'] as string;
  const authToken = req.headers['x-auth-token'] as string;

  if (!deviceId || !authToken) {
    return res.status(401).json({ error: 'Missing authentication headers' });
  }

  const device = await storage.getDevice(deviceId);
  if (!device) {
    return res.status(401).json({ error: 'Device not found' });
  }

  // BUG: Token comparison is not constant-time, vulnerable to timing attacks
  // BUG: No token expiration or rotation logic
  if (device.authToken !== authToken) {
    return res.status(403).json({ error: 'Invalid authentication token' });
  }

  (req as any).device = device;
  next();
}

export function requireAuth() {
  return authenticateDevice;
}
