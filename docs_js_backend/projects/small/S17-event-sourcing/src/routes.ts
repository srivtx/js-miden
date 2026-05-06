import { Router, Request, Response } from 'express';
import { createAccount, deposit, withdraw, getBalance, getEvents } from './store.js';

export const eventRouter = Router();

eventRouter.post('/accounts', (req: Request, res: Response) => {
  const { owner } = req.body;
  const account = createAccount(owner);
  res.status(201).json(account);
});

eventRouter.post('/accounts/:id/deposit', (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount } = req.body;
  const result = deposit(id, amount);
  if (!result) return res.status(404).json({ error: 'Account not found' });
  res.json(result);
});

eventRouter.post('/accounts/:id/withdraw', (req: Request, res: Response) => {
  const { id } = req.params;
  const { amount } = req.body;
  const result = withdraw(id, amount);
  if (!result) return res.status(404).json({ error: 'Account not found' });
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

eventRouter.get('/accounts/:id/balance', (req: Request, res: Response) => {
  const { id } = req.params;
  const result = getBalance(id);
  if (!result) return res.status(404).json({ error: 'Account not found' });
  res.json(result);
});

eventRouter.get('/accounts/:id/events', (req: Request, res: Response) => {
  const { id } = req.params;
  const events = getEvents(id);
  res.json({ events });
});
