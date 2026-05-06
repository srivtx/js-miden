import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { logAudit, getConsentByPatientId } from '../db.js';

// BUG: This middleware is defined but NOT applied to most routes.
// As a result, most patient data access is not audited,
// creating a HIPAA violation (who accessed what = unknown).

export function auditMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = function(body: unknown) {
    // Log after response is sent
    const resourceType = req.path.split('/')[2] || 'unknown';
    const resourceId = req.params.id || req.params.patientId || 'unknown';

    logAudit({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      action: req.method,
      resourceType,
      resourceId,
      userId: req.userId || 'anonymous',
      outcome: res.statusCode >= 400 ? 'failure' : 'success',
      ipAddress: req.ip || undefined,
    });

    return originalJson(body);
  };

  next();
}

export function consentMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const patientId = req.params.patientId || req.params.id;
  if (!patientId) {
    next();
    return;
  }

  const consent = getConsentByPatientId(patientId);
  if (consent && !consent.grantedTo.includes(req.userId!)) {
    res.status(403).json({ error: 'Access denied by patient consent' });
    return;
  }

  next();
}
