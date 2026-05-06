import { Router } from 'express';
import db from './db.js';
import { broadcastUnreadCount } from './sse.js';

const router = Router();

router.post('/notify', (req, res) => {
  const { user_id, type = 'general', title, body, data } = req.body;
  if (!user_id || !title || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const created_at = Date.now();
  const result = db.prepare(
    'INSERT INTO notifications (user_id, type, title, body, data, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(user_id, type, title, body, data ? JSON.stringify(data) : null, created_at);

  const notificationId = result.lastInsertRowid;

  // BUG: Race condition - read-modify-write on unread_count
  const userRow = db.prepare('SELECT unread_count FROM users WHERE id = ?').get(user_id) as { unread_count: number } | undefined;
  const currentCount = userRow ? userRow.unread_count : 0;
  const newCount = currentCount + 1;

  if (userRow) {
    db.prepare('UPDATE users SET unread_count = ? WHERE id = ?').run(newCount, user_id);
  } else {
    db.prepare('INSERT INTO users (id, unread_count) VALUES (?, ?)').run(user_id, newCount);
  }

  broadcastUnreadCount(user_id, newCount);

  res.status(201).json({ id: notificationId, unread_count: newCount });
});

router.get('/', (req, res) => {
  const user_id = req.query.user_id as string;
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  const rows = db.prepare(
    'SELECT id, user_id, type, title, body, data, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(user_id, limit, offset);

  const total = (db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?').get(user_id) as { count: number }).count;

  res.json({
    data: rows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

router.patch('/:id/read', (req, res) => {
  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id) as
    | { id: number; user_id: string; read: number }
    | undefined;

  if (!row) return res.status(404).json({ error: 'Not found' });

  if (!row.read) {
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);

    // BUG: Another race condition on decrement
    const userRow = db.prepare('SELECT unread_count FROM users WHERE id = ?').get(row.user_id) as { unread_count: number } | undefined;
    if (userRow) {
      const newCount = Math.max(0, userRow.unread_count - 1);
      db.prepare('UPDATE users SET unread_count = ? WHERE id = ?').run(newCount, row.user_id);
      broadcastUnreadCount(row.user_id, newCount);
    }
  }

  res.json({ success: true });
});

export default router;
