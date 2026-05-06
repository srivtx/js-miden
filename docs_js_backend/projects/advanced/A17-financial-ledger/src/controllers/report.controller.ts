import { Request, Response, NextFunction } from 'express';
import { exchangeService } from '../services/exchange.service.js';
import { accountService } from '../services/account.service.js';

export async function setExchangeRate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { from, to, rate } = req.body;
    const exchangeRate = await exchangeService.setRate(from, to, rate);
    res.status(201).json(exchangeRate);
  } catch (err) {
    next(err);
  }
}

export async function convertCurrency(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount, from, to } = req.body;
    const converted = await exchangeService.convert(amount, from, to);
    res.json({ amount, from, to, converted });
  } catch (err) {
    next(err);
  }
}

export async function getTrialBalance(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const accounts = await accountService.listAccounts();
    const trialBalance = await Promise.all(
      accounts.map(async (acc) => {
        const balance = await accountService.getBalance(acc.id);
        return {
          accountId: acc.id,
          code: acc.code,
          name: acc.name,
          debit: balance?.debit || 0,
          credit: balance?.credit || 0,
        };
      })
    );
    res.json(trialBalance);
  } catch (err) {
    next(err);
  }
}
