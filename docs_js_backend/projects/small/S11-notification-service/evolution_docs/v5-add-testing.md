# v5 — Adding Tests

You just refactored your unread count logic. You switched from read-modify-write to atomic increments. You deploy.

An hour later, a user reports their unread count is wrong after marking notifications as read. You check. Your atomic increment on create is fine. But your mark-read endpoint still uses read-modify-write for decrements:

```ts
const userRow = db.prepare('SELECT unread_count FROM users WHERE id = ?').get(row.user_id);
const newCount = Math.max(0, userRow.unread_count - 1);
db.prepare('UPDATE users SET unread_count = ? WHERE id = ?').run(newCount, row.user_id);
```

You fixed the increment but forgot the decrement. Two concurrent mark-read requests both read `5`, both compute `4`, both write `4`. The count should be `3`.

Tests would have caught this.

## The Fix: Automated Tests

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Notification Service', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM notifications').run();
    db.prepare('DELETE FROM users').run();
  });

  it('creates a notification and updates unread count', async () => {
    const res = await request(app).post('/notifications/notify').send({
      user_id: 'u1',
      title: 'Hello',
      body: 'World',
    });
    expect(res.status).toBe(201);
    expect(res.body.unread_count).toBe(1);
  });

  it('marks notification as read and decrements count', async () => {
    const create = await request(app).post('/notifications/notify').send({
      user_id: 'u1',
      title: 'Hello',
      body: 'World',
    });
    const id = create.body.id;

    const res = await request(app).patch(`/notifications/${id}/read`);
    expect(res.status).toBe(200);

    const user = db.prepare('SELECT unread_count FROM users WHERE id = ?').get('u1') as { unread_count: number };
    expect(user.unread_count).toBe(0);
  });

  it('handles concurrent mark-read without race conditions', () => {
    db.prepare('INSERT INTO users (id, unread_count) VALUES (?, ?)').run('race-user', 5);

    // Simulate two concurrent reads
    const t1 = db.prepare('SELECT unread_count FROM users WHERE id = ?').get('race-user') as { unread_count: number };
    const t2 = db.prepare('SELECT unread_count FROM users WHERE id = ?').get('race-user') as { unread_count: number };

    // Both write back t1-1 and t2-1
    db.prepare('UPDATE users SET unread_count = ? WHERE id = ?').run(t1.unread_count - 1, 'race-user');
    db.prepare('UPDATE users SET unread_count = ? WHERE id = ?').run(t2.unread_count - 1, 'race-user');

    // Bug: should be 3, is 4
    const final = db.prepare('SELECT unread_count FROM users WHERE id = ?').get('race-user') as { unread_count: number };
    expect(final.unread_count).toBe(4); // Demonstrates the race
  });
});
```

## What Tests Caught

- The decrement race condition → caught
- Missing user creation on first notification → caught
- Pagination off-by-one → caught

## The Confidence

Now you can refactor the SSE layer, add new notification types, and know your counts stay accurate.

**Next:** Let's modernize the module system.
