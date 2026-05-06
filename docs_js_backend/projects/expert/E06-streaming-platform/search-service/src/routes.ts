import { Router } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface SearchDoc {
  id: string;
  type: 'video' | 'series' | 'actor';
  title: string;
  tags: string[];
  meta: Record<string, any>;
}

const index: Map<string, SearchDoc> = new Map();

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
    const q = (req.query.q as string)?.toLowerCase() || '';
    const type = req.query.type as string | undefined;
    const results = Array.from(index.values()).filter((doc) => {
      if (type && doc.type !== type) return false;
      return doc.title.toLowerCase().includes(q) || doc.tags.some((t) => t.toLowerCase().includes(q));
    });
    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.post('/index', (req, res, next) => {
  try {
    const { id, type, title, tags, meta } = req.body;
    if (!id || !type || !title) return res.status(400).json({ error: 'Missing fields' });
    index.set(`${type}:${id}`, { id, type, title, tags: tags || [], meta: meta || {} });
    res.status(201).json({ indexed: true });
  } catch (err) {
    next(err);
  }
});

export { index };
export default router;
