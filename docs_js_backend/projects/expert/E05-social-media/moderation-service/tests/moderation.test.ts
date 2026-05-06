import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Moderation Service', () => {
  it('should require auth', async () => {
    const res = await request(app).post('/moderation/').send({ targetType: 'post', targetId: '1', reason: 'spam' });
    expect(res.status).toBe(401);
  });
});
