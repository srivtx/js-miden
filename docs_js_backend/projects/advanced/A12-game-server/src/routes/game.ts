import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { getSessionById } from '../db.js';
import { updateGameState, finishGame } from '../services/gameState.js';
import { recordWin } from '../services/antiCheat.js';

const router = Router();

router.post('/:sessionId/state', authMiddleware, (req: AuthRequest, res) => {
  const session = updateGameState(req.params.sessionId, req.userId!, req.body);
  if (!session) {
    res.status(404).json({ error: 'Session not found or not active' });
    return;
  }
  res.json(session.state);
});

router.post('/:sessionId/finish', authMiddleware, (req: AuthRequest, res) => {
  const { winnerId } = req.body;
  const session = finishGame(req.params.sessionId, winnerId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const loserId = session.playerIds.find(id => id !== winnerId);
  if (loserId) {
    recordWin(winnerId, loserId);
  }

  res.json(session);
});

router.get('/:sessionId', (req, res) => {
  const session = getSessionById(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});

export { router as gameRouter };
