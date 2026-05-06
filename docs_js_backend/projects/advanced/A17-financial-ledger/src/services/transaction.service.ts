import { Transaction, JournalEntry, TransactionStatus } from '../types/transaction.types.js';
import { Money } from '../utils/money.js';
import { logger } from '../utils/logger.js';
import { accountService } from './account.service.js';
import { ledgerService } from './ledger.service.js';
import { auditService } from './audit.service.js';

const transactions = new Map<string, Transaction>();

export class TransactionService {
  async create(data: Omit<Transaction, 'id' | 'createdAt' | 'status' | 'entries'> & { entries: Omit<JournalEntry, 'id' | 'transactionId'>[] }): Promise<Transaction> {
    // Validate double-entry: total debits must equal total credits
    const totalDebits = data.entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredits = data.entries.reduce((sum, e) => sum + e.credit, 0);

    // BUG: Uses floating-point comparison which may fail due to precision loss.
    if (totalDebits !== totalCredits) {
      throw new Error(`Debits (${totalDebits}) do not equal credits (${totalCredits})`);
    }

    const transactionId = crypto.randomUUID();
    const entries: JournalEntry[] = data.entries.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      transactionId,
      currency: data.currency,
      exchangeRate: 1,
    }));

    const transaction: Transaction = {
      ...data,
      id: transactionId,
      entries,
      status: 'draft',
      createdAt: new Date(),
    };

    transactions.set(transaction.id, transaction);
    logger.info({ transactionId: transaction.id }, 'Transaction created');
    return transaction;
  }

  async post(transactionId: string): Promise<Transaction | null> {
    const transaction = transactions.get(transactionId);
    if (!transaction) return null;
    if (transaction.status !== 'draft') {
      throw new Error('Only draft transactions can be posted');
    }

    // Update account balances
    for (const entry of transaction.entries) {
      await accountService.updateBalance(entry.accountId, entry.debit, entry.credit);
    }

    transaction.status = 'posted';
    transactions.set(transactionId, transaction);

    await ledgerService.append(transaction);
    await auditService.log('transaction', transactionId, 'posted', 'system', { entries: transaction.entries });

    logger.info({ transactionId }, 'Transaction posted');
    return transaction;
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    return transactions.get(id) || null;
  }

  async reverse(transactionId: string): Promise<Transaction | null> {
    const transaction = transactions.get(transactionId);
    if (!transaction) return null;

    const reversalEntries = transaction.entries.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      debit: e.credit,
      credit: e.debit,
      description: `Reversal of ${e.id}`,
    }));

    const reversal = await this.create({
      reference: `REV-${transaction.reference}`,
      description: `Reversal of transaction ${transactionId}`,
      date: new Date(),
      currency: transaction.currency,
      entries: reversalEntries,
    });

    await this.post(reversal.id);
    transaction.status = 'reversed';
    transactions.set(transactionId, transaction);

    return reversal;
  }
}

export const transactionService = new TransactionService();
