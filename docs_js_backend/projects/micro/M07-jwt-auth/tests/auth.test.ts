import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/server.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

describe('JWT Auth', () => {
  describe('POST /login', () => {
    it('should return a JWT token', async () => {
      const res = await request(app).post('/login').send({ userId: 'user123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe('string');
    });
  });

  describe('GET /protected', () => {
    it('should grant access with a valid token', async () => {
      const loginRes = await request(app).post('/login').send({ userId: 'user123' });

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${loginRes.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Access granted');
    });

    it('should reject expired tokens', async () => {
      // Create a token that expired 1 hour ago
      const expiredToken = jwt.sign({ sub: 'user123' }, SECRET, {
        expiresIn: '-1h',
        algorithm: 'HS256',
      });

      const res = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      // -----------------------------------------------------------------------
      // THIS ASSERTION FAILS DUE TO THE BUG:
      // The server uses ignoreExpiration: true, so expired tokens are accepted.
      // Expected: 401 Unauthorized | Actual: 200 OK
      // -----------------------------------------------------------------------
      expect(res.status).toBe(401);
    });

    it('should reject requests without a token', async () => {
      const res = await request(app).get('/protected');
      expect(res.status).toBe(401);
    });
  });
});
