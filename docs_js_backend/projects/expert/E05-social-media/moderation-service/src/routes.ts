import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface Report {
  id: string;
  reporterId: string;
  targetType: 'post' | 'user' | 'comment';
  targetId: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  createdAt: string;
}

const reports: Map<string, Report> = new Map();

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
    const reporterId = getUserId(req);
    if (!reporterId) return res.status(401).json({ error: 'Unauthorized' });
    const { targetType, targetId, reason } = req.body;
    if (!targetType || !targetId || !reason) return res.status(400).json({ error: 'Missing fields' });
    const report: Report = {
      id: uuidv4(),
      reporterId,
      targetType,
      targetId,
      reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    reports.set(report.id, report);
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const status = req.query.status as string | undefined;
    const list = Array.from(reports.values())
      .filter((r) => (status ? r.status === status : true))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { status } = req.body;
    if (!status || !['pending', 'reviewed', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const report = reports.get(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    report.status = status;
    reports.set(report.id, report);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

export { reports };
export default router;
