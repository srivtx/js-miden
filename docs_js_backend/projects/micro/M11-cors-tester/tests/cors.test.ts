import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('CORS Tester', () => {
  describe('GET /public', () => {
    it('should allow any origin without credentials', async () => {
      const res = await request(app)
        .get('/public')
        .set('Origin', 'https://evil.com');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.body.message).toBe('Public data');
    });

    it('should handle preflight for public route', async () => {
      const res = await request(app)
        .options('/public')
        .set('Origin', 'https://example.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('GET /private', () => {
    it('should require authorization', async () => {
      const res = await request(app).get('/private');
      expect(res.status).toBe(401);
    });

    it('should NOT use wildcard origin when credentials are enabled', async () => {
      const res = await request(app)
        .get('/private')
        .set('Origin', 'https://evil.com')
        .set('Authorization', 'Bearer secret-token');

      // -----------------------------------------------------------------------
      // THIS ASSERTION FAILS DUE TO THE BUG:
      // The server uses cors({ origin: '*', credentials: true }), which sends
      // Access-Control-Allow-Origin: * along with Access-Control-Allow-Credentials: true.
      // This is a CORS security vulnerability: it tells any origin it can read
      // authenticated responses. A correct implementation should validate the
      // origin against an allowlist and reflect the exact origin back.
      // -----------------------------------------------------------------------
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    });

    it('should handle preflight for private route', async () => {
      const res = await request(app)
        .options('/private')
        .set('Origin', 'https://example.com')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'Authorization');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-methods']).toContain('GET');
    });
  });
});
