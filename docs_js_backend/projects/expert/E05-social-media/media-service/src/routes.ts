import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface Media {
  id: string;
  ownerId: string;
  type: 'image' | 'video';
  url: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

const mediaStore: Map<string, Media> = new Map();

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

router.post('/upload', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { type, url, filename, sizeBytes } = req.body;
    if (!type || !url) return res.status(400).json({ error: 'Missing fields' });
    const media: Media = {
      id: uuidv4(),
      ownerId: userId,
      type,
      url,
      filename: filename || '',
      sizeBytes: sizeBytes || 0,
      createdAt: new Date().toISOString(),
    };
    mediaStore.set(media.id, media);
    res.status(201).json(media);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const media = mediaStore.get(req.params.id);
    if (!media) return res.status(404).json({ error: 'Media not found' });
    res.json(media);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const media = mediaStore.get(req.params.id);
    if (!media) return res.status(404).json({ error: 'Media not found' });
    if (media.ownerId !== userId) return res.status(403).json({ error: 'Forbidden' });
    mediaStore.delete(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export { mediaStore };
export default router;
