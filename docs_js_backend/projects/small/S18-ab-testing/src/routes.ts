import { Router, Request, Response } from 'express';
import { assignVariant, trackConversion, getStats } from './store.js';

export const experimentRouter = Router();

// BUG: Non-deterministic assignment
experimentRouter.get('/:name', (req: Request, res: Response) => {
  const { name } = req.params;
  const userId = req.query.userId as string || 'anonymous';
  
  // BUG: Math.random() is non-deterministic - same user gets different variants
  const variant = assignVariant(name, userId);
  res.json({ experiment: name, userId, variant });
});

experimentRouter.post('/:name/conversion', (req: Request, res: Response) => {
  const { name } = req.params;
  const { userId, value } = req.body;
  trackConversion(name, userId, value);
  res.json({ success: true });
});

experimentRouter.get('/:name/stats', (req: Request, res: Response) => {
  const { name } = req.params;
  const stats = getStats(name);
  if (!stats) return res.status(404).json({ error: 'Experiment not found' });
  res.json(stats);
});
