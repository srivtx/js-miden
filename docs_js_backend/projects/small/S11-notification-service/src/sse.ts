import { Router, Response } from 'express';
import db from './db.js';

export const clients = new Map<string, Set<Response>>();

export function broadcastUnreadCount(userId: string, count: number) {
  const userClients = clients.get(userId);
  if (!userClients) return;
  const data = JSON.stringify({ user_id: userId, unread_count: count });
  for (const client of userClients) {
    client.write(`data: ${data}\n\n`);
  }
}

const router = Router();

router.get('/stream', (req, res) => {
  const user_id = req.query.user_id as string;
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!clients.has(user_id)) clients.set(user_id, new Set());
  clients.get(user_id)!.add(res);

  // Send initial count
  const userRow = db.prepare('SELECT unread_count FROM users WHERE id = ?').get(user_id) as { unread_count: number } | undefined;
  const initialCount = userRow ? userRow.unread_count : 0;
  res.write(`data: ${JSON.stringify({ user_id, unread_count: initialCount })}\n\n`);

  req.on('close', () => {
    clients.get(user_id)?.delete(res);
    if (clients.get(user_id)?.size === 0) clients.delete(user_id);
  });
});

export default router;
