import { Router } from 'express';
import { getLeaderboard } from '../services/antiCheat.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(getLeaderboard());
});

export { router as leaderboardRouter };
