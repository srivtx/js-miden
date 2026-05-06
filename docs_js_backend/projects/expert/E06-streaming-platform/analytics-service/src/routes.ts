import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface WatchEvent {
  id: string;
  userId: string;
  profileId: string;
  videoId: string;
  eventType: 'start' | 'pause' | 'resume' | 'complete' | 'progress';
  positionSeconds: number;
  timestamp: string;
}

const events: Map<string, WatchEvent> = new Map();

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

router.post('/events', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { profileId, videoId, eventType, positionSeconds } = req.body;
    if (!profileId || !videoId || !eventType) return res.status(400).json({ error: 'Missing fields' });
    const event: WatchEvent = {
      id: uuidv4(),
      userId,
      profileId,
      videoId,
      eventType,
      positionSeconds: positionSeconds || 0,
      timestamp: new Date().toISOString(),
    };
    events.set(event.id, event);
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

router.get('/history/:profileId', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const list = Array.from(events.values())
      .filter((e) => e.profileId === req.params.profileId && e.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.get('/continue-watching/:profileId', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const profileEvents = Array.from(events.values())
      .filter((e) => e.profileId === req.params.profileId && e.userId === userId && e.eventType === 'progress')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    // Latest progress per video
    const latest = new Map<string, WatchEvent>();
    for (const e of profileEvents) {
      if (!latest.has(e.videoId)) latest.set(e.videoId, e);
    }
    res.json(Array.from(latest.values()));
  } catch (err) {
    next(err);
  }
});

export { events };
export default router;
