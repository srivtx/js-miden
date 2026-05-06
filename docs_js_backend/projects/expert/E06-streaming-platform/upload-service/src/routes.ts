import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface Upload {
  id: string;
  ownerId: string;
  originalFilename: string;
  sizeBytes: number;
  mimeType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

const uploads: Map<string, Upload> = new Map();

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
    const ownerId = getUserId(req);
    if (!ownerId) return res.status(401).json({ error: 'Unauthorized' });
    const { originalFilename, sizeBytes, mimeType } = req.body;
    if (!originalFilename || !mimeType) return res.status(400).json({ error: 'Missing fields' });
    const upload: Upload = {
      id: uuidv4(),
      ownerId,
      originalFilename,
      sizeBytes: sizeBytes || 0,
      mimeType,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    uploads.set(upload.id, upload);
    res.status(201).json(upload);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const upload = uploads.get(req.params.id);
    if (!upload) return res.status(404).json({ error: 'Upload not found' });
    res.json(upload);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { status } = req.body;
    const upload = uploads.get(req.params.id);
    if (!upload) return res.status(404).json({ error: 'Upload not found' });
    if (upload.ownerId !== userId) return res.status(403).json({ error: 'Forbidden' });
    upload.status = status;
    uploads.set(upload.id, upload);
    res.json(upload);
  } catch (err) {
    next(err);
  }
});

export { uploads };
export default router;
