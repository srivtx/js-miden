import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';

describe('Notification Service', () => {
  it('should require auth for list', async () => {
    const res = await request(app).get('/notifications/');
    expect(res.status).toBe(401);
  });
});
