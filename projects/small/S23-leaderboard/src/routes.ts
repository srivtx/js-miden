import { Router, Request, Response } from 'express';
import { submitScore, getLeaderboard, getUserRank } from './service.js';

export const router = Router();

router.post('/score', async (req: Request, res: Response) => {
  try {
    const entry = await submitScore(req.body);
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/leaderboard', async (req: Request, res: Response) => {
  const period = (req.query.period as 'daily' | 'weekly' | 'all-time') || 'all-time';
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
  const board = await getLeaderboard(period, limit);
  res.json(board);
});

router.get('/rank/:userId', async (req: Request, res: Response) => {
  const period = (req.query.period as 'daily' | 'weekly' | 'all-time') || 'all-time';
  const rank = await getUserRank(req.params.userId as string, period);
  if (!rank) return res.status(404).json({ error: 'User not found' });
  res.json(rank);
});
