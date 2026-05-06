import { Router } from 'express';
import { pool } from '../db.js';
import { sendWebhook } from '../services/sender.js';
import type { Request, Response } from 'express';

const router = Router();

router.post('/webhooks', async (req: Request, res: Response) => {
  const { url, event_types, secret } = req.body;
  if (!url || !Array.isArray(event_types)) {
    res.status(400).json({ error: 'url and event_types are required' });
    return;
  }

  const result = await pool.query(
    `INSERT INTO webhooks (url, event_types, secret) VALUES ($1, $2, $3) RETURNING *`,
    [url, event_types, secret || '']
  );

  res.status(201).json({ webhook: result.rows[0] });
});

router.post('/events', async (req: Request, res: Response) => {
  const { event_type, payload } = req.body;
  if (!event_type || !payload) {
    res.status(400).json({ error: 'event_type and payload are required' });
    return;
  }

  const webhooks = await pool.query(
    `SELECT id FROM webhooks WHERE $1 = ANY(event_types)`,
    [event_type]
  );

  const logs = [];
  for (const webhook of webhooks.rows) {
    const logResult = await pool.query(
      `INSERT INTO delivery_logs (webhook_id, event_type, payload, status)
       VALUES ($1, $2, $3, 'pending') RETURNING *`,
      [webhook.id, event_type, JSON.stringify(payload)]
    );
    logs.push(logResult.rows[0]);
  }

  // Send asynchronously
  for (const log of logs) {
    sendWebhook(log).catch(console.error);
  }

  res.status(202).json({ queued: logs.length });
});

router.get('/webhooks/:id/logs', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const result = await pool.query(
    `SELECT * FROM delivery_logs WHERE webhook_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  res.json({ logs: result.rows });
});

export default router;
