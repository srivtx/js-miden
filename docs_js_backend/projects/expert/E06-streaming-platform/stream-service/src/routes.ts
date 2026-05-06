import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface Video {
  id: string;
  title: string;
  description: string;
  uploadId: string;
  transcodeJobId: string;
  drmTier: 'free' | 'premium'; // DRM protection level
  subtitles: { language: string; url: string }[];
  durationSeconds: number;
  createdAt: string;
}

export interface StreamSession {
  id: string;
  userId: string;
  videoId: string;
  quality: string;
  startedAt: string;
}

const videos: Map<string, Video> = new Map();
const sessions: Map<string, StreamSession> = new Map();

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

router.post('/videos', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { title, description, uploadId, transcodeJobId, drmTier, durationSeconds } = req.body;
    if (!title || !uploadId) return res.status(400).json({ error: 'Missing fields' });
    const video: Video = {
      id: uuidv4(),
      title,
      description: description || '',
      uploadId,
      transcodeJobId: transcodeJobId || '',
      drmTier: drmTier || 'free',
      subtitles: [],
      durationSeconds: durationSeconds || 0,
      createdAt: new Date().toISOString(),
    };
    videos.set(video.id, video);
    res.status(201).json(video);
  } catch (err) {
    next(err);
  }
});

router.get('/videos', (req, res, next) => {
  try {
    const list = Array.from(videos.values());
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.get('/videos/:id', (req, res, next) => {
  try {
    const video = videos.get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json(video);
  } catch (err) {
    next(err);
  }
});

router.post('/videos/:id/stream', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const video = videos.get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });

    // BUG: No DRM validation is performed here.
    // The code checks that the user has a valid JWT, but never verifies
    // whether the user's subscription tier allows access to premium content.
    // This means anyone with a valid token can stream premium videos.
    // Missing: call to subscription-service to check user plan.

    const { quality } = req.body;
    const session: StreamSession = {
      id: uuidv4(),
      userId,
      videoId: video.id,
      quality: quality || 'auto',
      startedAt: new Date().toISOString(),
    };
    sessions.set(session.id, session);

    res.json({
      sessionId: session.id,
      manifestUrl: `https://cdn.example.com/v/${video.id}/manifest.m3u8`,
      quality: session.quality,
      drmRequired: video.drmTier === 'premium',
      // BUG: We tell client DRM is required, but we provide the stream anyway
      // without validating the user's DRM license or subscription.
    });
  } catch (err) {
    next(err);
  }
});

router.get('/sessions/:id', (req, res, next) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    next(err);
  }
});

export { videos, sessions };
export default router;
