import { JournalEntry } from '../types/transaction.types.js';
import { AuditLog } from '../types/journal.types.js';
import { logger } from '../utils/logger.js';

const journal = new Map<string, JournalEntry[]>();

export class LedgerService {
  async append(transaction: { id: string; entries: JournalEntry[] }): Promise<void> {
    journal.set(transaction.id, transaction.entries);
    logger.info({ transactionId: transaction.id, entryCount: transaction.entries.length }, 'Appended to ledger');
  }

  async getEntries(transactionId: string): Promise<JournalEntry[]> {
    return journal.get(transactionId) || [];
  }

  async verifyIntegrity(): Promise<boolean> {
    // In production: verify hash chain of all entries
    logger.info('Verifying ledger integrity');
    return true;
  }

  async getImmutableLog(): Promise<AuditLog[]> {
    // In production: return cryptographically signed log
    return [];
  }
}

export const ledgerService = new LedgerService();
