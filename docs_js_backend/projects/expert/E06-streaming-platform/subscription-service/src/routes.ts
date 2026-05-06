import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface Subscription {
  id: string;
  userId: string;
  plan: 'free' | 'premium' | 'family';
  active: boolean;
  expiresAt: string;
  createdAt: string;
}

const subscriptions: Map<string, Subscription> = new Map();

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

router.post('/', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { plan, expiresAt } = req.body;
    if (!plan || !expiresAt) return res.status(400).json({ error: 'Missing fields' });
    const sub: Subscription = {
      id: uuidv4(),
      userId,
      plan,
      active: true,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    subscriptions.set(sub.id, sub);
    res.status(201).json(sub);
  } catch (err) {
    next(err);
  }
});

router.get('/me', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const sub = Array.from(subscriptions.values()).find((s) => s.userId === userId && s.active);
    res.json(sub || null);
  } catch (err) {
    next(err);
  }
});

router.get('/user/:userId', (req, res, next) => {
  try {
    const sub = Array.from(subscriptions.values()).find((s) => s.userId === req.params.userId && s.active);
    res.json(sub || null);
  } catch (err) {
    next(err);
  }
});

export { subscriptions };
export default router;
