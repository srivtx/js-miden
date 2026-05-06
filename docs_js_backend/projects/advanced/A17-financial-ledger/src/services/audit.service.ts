import { AuditLog } from '../types/journal.types.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

const auditLogs: AuditLog[] = [];

export class AuditService {
  async log(
    entityType: AuditLog['entityType'],
    entityId: string,
    action: AuditLog['action'],
    performedBy: string,
    details: Record<string, unknown>
  ): Promise<AuditLog> {
    const previousHash = auditLogs.length > 0 ? auditLogs[auditLogs.length - 1].hash : '0';
    const data = JSON.stringify({ entityType, entityId, action, performedBy, details, previousHash, timestamp: new Date().toISOString() });
    const hash = crypto.createHash('sha256').update(data).digest('hex');

    const log: AuditLog = {
      id: crypto.randomUUID(),
      entityType,
      entityId,
      action,
      performedBy,
      timestamp: new Date(),
      hash,
      previousHash,
      details,
    };

    auditLogs.push(log);
    logger.info({ auditId: log.id, entityType, entityId, action }, 'Audit log created');
    return log;
  }

  async getLogs(entityType?: AuditLog['entityType'], entityId?: string): Promise<AuditLog[]> {
    return auditLogs.filter((l) => {
      if (entityType && l.entityType !== entityType) return false;
      if (entityId && l.entityId !== entityId) return false;
      return true;
    });
  }

  async verifyChain(): Promise<boolean> {
    for (let i = 1; i < auditLogs.length; i++) {
      if (auditLogs[i].previousHash !== auditLogs[i - 1].hash) {
        logger.error({ index: i }, 'Audit chain broken');
        return false;
      }
    }
    return true;
  }
}

export const auditService = new AuditService();
