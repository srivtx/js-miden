import { Router } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface RecItem {
  videoId: string;
  score: number;
  reason: string;
}

const recommendations: Map<string, RecItem[]> = new Map();

function getUserId(req: any): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
    return payload.userId;
  } catch {
    return null;
  }
}

const router = Router();

router.get('/', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const items = recommendations.get(userId) || [];
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post('/generate', (req, res, next) => {
  try {
    const { userId, items } = req.body;
    if (!userId || !Array.isArray(items)) return res.status(400).json({ error: 'Missing fields' });
    recommendations.set(userId, items);
    res.json({ generated: true, count: items.length });
  } catch (err) {
    next(err);
  }
});

export { recommendations };
export default router;
