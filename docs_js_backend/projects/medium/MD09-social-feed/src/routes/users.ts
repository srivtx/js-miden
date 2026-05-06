import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { users, follows } from '../db.js';

const router = Router();

router.post('/:id/follow', authMiddleware, (req: AuthRequest, res) => {
  const followeeId = req.params.id;
  const followerId = req.userId!;
  
  if (followerId === followeeId) {
    res.status(400).json({ error: 'Cannot follow yourself' });
    return;
  }
  
  const followee = users.get(followeeId);
  if (!followee) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  
  const key = `${followerId}:${followeeId}`;
  if (follows.has(key)) {
    res.status(400).json({ error: 'Already following' });
    return;
  }
  
  follows.set(key, { followerId, followeeId, createdAt: new Date() });
  followee.followerCount++;
  res.json({ following: true });
});

export { router as usersRouter };
