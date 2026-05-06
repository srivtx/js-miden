import { Request, Response, NextFunction } from 'express';
import { accountService } from '../services/account.service.js';
import { ApiError } from '../middleware/error.middleware.js';

export async function createAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const account = await accountService.create(req.body);
    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
}

export async function getAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const account = await accountService.getAccount(req.params.id);
    if (!account) {
      const error: ApiError = new Error('Account not found');
      error.statusCode = 404;
      throw error;
    }
    res.json(account);
  } catch (err) {
    next(err);
  }
}

export async function getBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const balance = await accountService.getBalance(req.params.id);
    if (!balance) {
      const error: ApiError = new Error('Balance not found');
      error.statusCode = 404;
      throw error;
    }
    res.json(balance);
  } catch (err) {
    next(err);
  }
}

export async function listAccounts(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const accounts = await accountService.listAccounts();
    res.json(accounts);
  } catch (err) {
    next(err);
  }
}
