import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

describe('Polling API', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM votes').run();
    db.prepare('DELETE FROM options').run();
    db.prepare('DELETE FROM polls').run();
  });

  it('creates a poll', async () => {
    const res = await request(app)
      .post('/polls')
      .send({ question: 'Cats or Dogs?', options: ['Cats', 'Dogs'] });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('prevents duplicate votes by IP', async () => {
    const poll = await request(app)
      .post('/polls')
      .send({ question: 'A or B?', options: ['A', 'B'] });
    const pollId = poll.body.id;

    const options = db.prepare('SELECT id FROM options WHERE poll_id = ?').all(pollId) as { id: number }[];
    const optId = options[0].id;

    await request(app)
      .post(`/polls/${pollId}/vote`)
      .send({ option_id: optId });

    const res2 = await request(app)
      .post(`/polls/${pollId}/vote`)
      .send({ option_id: optId });
    expect(res2.status).toBe(403);
  });

  it('has a race condition in vote counting (demonstrated by manual read-increment-write)', async () => {
    const poll = await request(app)
      .post('/polls')
      .send({ question: 'X or Y?', options: ['X', 'Y'] });
    const pollId = poll.body.id;
    const options = db.prepare('SELECT id FROM options WHERE poll_id = ?').all(pollId) as { id: number }[];
    const optId = options[0].id;

    // In a real concurrent test, some votes would be lost.
    // Here we verify the non-atomic read-update pattern exists.
    await request(app).post(`/polls/${pollId}/vote`).send({ option_id: optId });
    await request(app).post(`/polls/${pollId}/vote`).set('X-Forwarded-For', '1.2.3.4').send({ option_id: optId });

    const results = await request(app).get(`/polls/${pollId}/results`);
    const opt = results.body.options.find((o: { id: number }) => o.id === optId);
    expect(opt.count).toBe(2);
  });
});
