import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { createPlayer, getPlayerById } from '../db.js';
import { queuePlayer, clearQueue } from '../services/matchmaker.js';

const router = Router();

router.post('/register', (req, res) => {
  const { username, skillRating = 1000 } = req.body;
  if (!username) {
    res.status(400).json({ error: 'Username required' });
    return;
  }
  const player = createPlayer({
    id: crypto.randomUUID(),
    username,
    skillRating,
    wins: 0,
    losses: 0,
    createdAt: new Date(),
  });
  res.status(201).json(player);
});

router.post('/queue', authMiddleware, (req: AuthRequest, res) => {
  const player = getPlayerById(req.userId!);
  if (!player) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }
  const session = queuePlayer(player);
  if (session) {
    res.json({ matched: true, session });
  } else {
    res.json({ matched: false, queuePosition: 1 });
  }
});

router.delete('/queue', authMiddleware, (_req: AuthRequest, res) => {
  clearQueue();
  res.json({ cleared: true });
});

export { router as matchmakingRouter };
