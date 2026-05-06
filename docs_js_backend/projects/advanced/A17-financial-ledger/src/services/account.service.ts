import { Account, Balance, AccountType } from '../types/account.types.js';
import { logger } from '../utils/logger.js';

const accounts = new Map<string, Account>();
const balances = new Map<string, Balance>();

export class AccountService {
  async create(data: Omit<Account, 'id' | 'createdAt'>): Promise<Account> {
    const account: Account = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };

    accounts.set(account.id, account);

    // Initialize balance
    balances.set(account.id, {
      accountId: account.id,
      debit: 0,
      credit: 0,
      netBalance: 0,
      currency: account.currency,
      asOfDate: new Date(),
    });

    logger.info({ accountId: account.id }, 'Account created');
    return account;
  }

  async getAccount(id: string): Promise<Account | null> {
    return accounts.get(id) || null;
  }

  async getBalance(accountId: string): Promise<Balance | null> {
    return balances.get(accountId) || null;
  }

  async listAccounts(): Promise<Account[]> {
    return Array.from(accounts.values());
  }

  async updateBalance(accountId: string, debitDelta: number, creditDelta: number): Promise<Balance | null> {
    const balance = balances.get(accountId);
    if (!balance) return null;

    balance.debit += debitDelta;
    balance.credit += creditDelta;

    // Net balance depends on account type
    const account = accounts.get(accountId);
    if (account) {
      balance.netBalance = this.calculateNetBalance(account.type, balance.debit, balance.credit);
    }

    balance.asOfDate = new Date();
    balances.set(accountId, balance);
    return balance;
  }

  private calculateNetBalance(type: AccountType, debit: number, credit: number): number {
    // Assets & Expenses: Debit increases balance
    // Liabilities, Equity, Revenue: Credit increases balance
    if (type === 'asset' || type === 'expense') {
      return debit - credit;
    }
    return credit - debit;
  }
}

export const accountService = new AccountService();
