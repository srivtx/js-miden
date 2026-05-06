import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface TranscodeJob {
  id: string;
  uploadId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  qualities: string[];
  outputs: { quality: string; url: string }[];
  createdAt: string;
}

const jobs: Map<string, TranscodeJob> = new Map();

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
    const { uploadId, qualities } = req.body;
    if (!uploadId) return res.status(400).json({ error: 'Missing uploadId' });
    const id = uuidv4();
    const job: TranscodeJob = {
      id,
      uploadId,
      status: 'queued',
      qualities: qualities || ['720p', '1080p'],
      outputs: [],
      createdAt: new Date().toISOString(),
    };
    jobs.set(id, job);
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { status, outputs } = req.body;
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (status) job.status = status;
    if (outputs) job.outputs = outputs;
    jobs.set(job.id, job);
    res.json(job);
  } catch (err) {
    next(err);
  }
});

export { jobs };
export default router;
