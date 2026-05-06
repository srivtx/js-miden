import { Request, Response, NextFunction } from 'express';
import { ledgerService } from '../services/ledger.service.js';
import { auditService } from '../services/audit.service.js';

export async function getJournalEntries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entries = await ledgerService.getEntries(req.params.transactionId);
    res.json(entries);
  } catch (err) {
    next(err);
  }
}

export async function verifyLedger(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const valid = await ledgerService.verifyIntegrity();
    res.json({ valid });
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { entityType, entityId } = req.query;
    const logs = await auditService.getLogs(
      entityType as any,
      entityId as string
    );
    res.json(logs);
  } catch (err) {
    next(err);
  }
}

export async function verifyAuditChain(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const valid = await auditService.verifyChain();
    res.json({ valid });
  } catch (err) {
    next(err);
  }
}
