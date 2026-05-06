import { storage } from './storage.js';

export interface AuditLog {
  id: string;
  contentId: string;
  action: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export async function getAuditTrail(contentId: string): Promise<AuditLog[]> {
  return storage.getAuditTrail(contentId);
}

export async function logAction(contentId: string, action: string, details?: Record<string, unknown>): Promise<AuditLog> {
  const log: AuditLog = {
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    contentId,
    action,
    details,
    timestamp: Date.now(),
  };
  await storage.addAuditLog(log);
  return log;
}
