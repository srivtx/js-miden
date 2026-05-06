import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  actorId: string;
  postId?: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const notifications: Map<string, Notification> = new Map();

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
    const list = Array.from(notifications.values())
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const { userId, type, actorId, postId, message } = req.body;
    if (!userId || !type || !actorId || !message) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const notif: Notification = {
      id: uuidv4(),
      userId,
      type,
      actorId,
      postId,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    };
    notifications.set(notif.id, notif);
    res.status(201).json(notif);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const notif = notifications.get(req.params.id);
    if (!notif) return res.status(404).json({ error: 'Not found' });
    if (notif.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
    notif.read = true;
    notifications.set(notif.id, notif);
    res.json(notif);
  } catch (err) {
    next(err);
  }
});

export { notifications };
export default router;
