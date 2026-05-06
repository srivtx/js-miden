import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

describe('Notification Service', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM notifications').run();
    db.prepare('DELETE FROM users').run();
  });

  it('creates a notification and updates unread count', async () => {
    const res = await request(app).post('/notifications/notify').send({
      user_id: 'u1',
      title: 'Hello',
      body: 'World'
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.unread_count).toBe(1);
  });

  it('lists notifications with pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/notifications/notify').send({
        user_id: 'u1',
        title: `Notif ${i}`,
        body: 'body'
      });
    }
    const res = await request(app).get('/notifications?user_id=u1&limit=2&page=1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.total).toBe(5);
  });

  it('marks notification as read', async () => {
    const create = await request(app).post('/notifications/notify').send({
      user_id: 'u1',
      title: 'Hello',
      body: 'World'
    });
    const id = create.body.id;

    const res = await request(app).patch(`/notifications/${id}/read`);
    expect(res.status).toBe(200);

    const notif = db.prepare('SELECT read FROM notifications WHERE id = ?').get(id) as { read: number };
    expect(notif.read).toBe(1);

    const user = db.prepare('SELECT unread_count FROM users WHERE id = ?').get('u1') as { unread_count: number };
    expect(user.unread_count).toBe(0);
  });

  it('BUG: demonstrates race condition in unread count', () => {
    // Setup: user has 5 unread notifications
    db.prepare('INSERT INTO users (id, unread_count) VALUES (?, ?)').run('race-user', 5);

    // Simulate two concurrent mark-read requests
    // Both read count=5, both compute 4, both write 4
    // Expected: 3, Actual (due to race): 4
    const t1 = db.prepare('SELECT unread_count FROM users WHERE id = ?').get('race-user') as { unread_count: number };
    const t2 = db.prepare('SELECT unread_count FROM users WHERE id = ?').get('race-user') as { unread_count: number };

    db.prepare('UPDATE users SET unread_count = ? WHERE id = ?').run(t1.unread_count - 1, 'race-user');
    db.prepare('UPDATE users SET unread_count = ? WHERE id = ?').run(t2.unread_count - 1, 'race-user');

    const final = db.prepare('SELECT unread_count FROM users WHERE id = ?').get('race-user') as { unread_count: number };
    expect(final.unread_count).toBe(4); // Should be 3
  });
});
