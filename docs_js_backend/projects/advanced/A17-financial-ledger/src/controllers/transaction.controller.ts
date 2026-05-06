import { Request, Response, NextFunction } from 'express';
import { transactionService } from '../services/transaction.service.js';
import { ApiError } from '../middleware/error.middleware.js';

export async function createTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const transaction = await transactionService.create(req.body);
    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
}

export async function getTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const transaction = await transactionService.getTransaction(req.params.id);
    if (!transaction) {
      const error: ApiError = new Error('Transaction not found');
      error.statusCode = 404;
      throw error;
    }
    res.json(transaction);
  } catch (err) {
    next(err);
  }
}

export async function postTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const transaction = await transactionService.post(req.params.id);
    if (!transaction) {
      const error: ApiError = new Error('Transaction not found');
      error.statusCode = 404;
      throw error;
    }
    res.json(transaction);
  } catch (err) {
    next(err);
  }
}

export async function reverseTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reversal = await transactionService.reverse(req.params.id);
    if (!reversal) {
      const error: ApiError = new Error('Transaction not found');
      error.statusCode = 404;
      throw error;
    }
    res.status(201).json(reversal);
  } catch (err) {
    next(err);
  }
}
