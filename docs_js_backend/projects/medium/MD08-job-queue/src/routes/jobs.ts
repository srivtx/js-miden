import { Router } from 'express';
import { pool } from '../db.js';
import { addTranscodeJob } from '../queue.js';
import type { Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

function generateJobId(): string {
  return crypto.randomUUID();
}

router.post('/jobs', async (req: Request, res: Response) => {
  const { type, payload } = req.body;
  if (!type || !payload) {
    res.status(400).json({ error: 'type and payload are required' });
    return;
  }

  const jobId = generateJobId();

  // Idempotency: check if job with same payload exists and is completed
  const existing = await pool.query(
    `SELECT id, status, result FROM jobs 
     WHERE type = $1 AND payload = $2 AND status IN ('pending', 'processing', 'completed')
     LIMIT 1`,
    [type, JSON.stringify(payload)]
  );

  if (existing.rows.length > 0 && existing.rows[0].status === 'completed') {
    res.status(200).json({ job: existing.rows[0], cached: true });
    return;
  }

  await pool.query(
    `INSERT INTO jobs (id, type, payload, status) VALUES ($1, $2, $3, 'pending')`,
    [jobId, type, JSON.stringify(payload)]
  );

  if (type === 'video.transcode') {
    await addTranscodeJob({ jobId, ...payload });
  }

  res.status(202).json({ jobId, status: 'pending' });
});

router.get('/jobs/:id', async (req: Request, res: Response) => {
  const result = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [req.params.id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json({ job: result.rows[0] });
});

router.get('/jobs/:id/progress', async (req: Request, res: Response) => {
  const result = await pool.query(`SELECT progress, status FROM jobs WHERE id = $1`, [req.params.id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json({ progress: result.rows[0].progress, status: result.rows[0].status });
});

// BUGGY: No idempotency - always creates new job even if same payload exists
router.post('/jobs-no-idempotency', async (req: Request, res: Response) => {
  const { type, payload } = req.body;
  const jobId = generateJobId();
  await pool.query(
    `INSERT INTO jobs (id, type, payload, status) VALUES ($1, $2, $3, 'pending')`,
    [jobId, type, JSON.stringify(payload)]
  );
  res.status(202).json({ jobId, status: 'pending' });
});

export default router;
