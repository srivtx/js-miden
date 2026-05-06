export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  currency: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface Balance {
  accountId: string;
  debit: number;
  credit: number;
  netBalance: number;
  currency: string;
  asOfDate: Date;
}
