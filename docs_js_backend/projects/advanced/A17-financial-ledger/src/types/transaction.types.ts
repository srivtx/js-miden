export interface Transaction {
  id: string;
  reference: string;
  description: string;
  date: Date;
  currency: string;
  entries: JournalEntry[];
  status: TransactionStatus;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export type TransactionStatus = 'draft' | 'posted' | 'reversed';

export interface JournalEntry {
  id: string;
  transactionId: string;
  accountId: string;
  debit: number;
  credit: number;
  currency: string;
  exchangeRate: number;
  description?: string;
}

export interface Reconciliation {
  id: string;
  accountId: string;
  statementDate: Date;
  statementBalance: number;
  ledgerBalance: number;
  difference: number;
  status: 'pending' | 'matched' | 'unmatched';
  createdAt: Date;
}
