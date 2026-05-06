import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).userId = decoded.userId;
    (req as any).tenantId = decoded.tenantId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  // BUG: tenant claim from JWT is not validated against the request context
  const requestTenant = req.headers['x-tenant-id'] || req.subdomains[0];
  (req as any).requestTenant = requestTenant;
  next();
}
