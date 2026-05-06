import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Error Handler', () => {
  it('should return 400 for invalid input', async () => {
    const res = await request(app).post('/divide').send({ a: 'foo', b: 2 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('type');
    expect(res.body).toHaveProperty('title', 'Bad Request');
    expect(res.body).toHaveProperty('status', 400);
  });

  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown-route');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('status', 404);
    expect(res.body).toHaveProperty('title', 'Not Found');
  });

  it('should return 500 for async errors', async () => {
    const res = await request(app).get('/async-error');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('title', 'Internal Server Error');
  });

  it('should NOT expose stack traces in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const res = await request(app).get('/async-error');

    process.env.NODE_ENV = originalEnv;

    // -----------------------------------------------------------------------
    // THIS ASSERTION FAILS DUE TO THE BUG:
    // The global error handler always includes `stack` in the response body,
    // regardless of environment. In production, this leaks internal file
    // paths and implementation details to potential attackers.
    // -----------------------------------------------------------------------
    expect(res.body).not.toHaveProperty('stack');
  });

  it('should handle errors gracefully after headers are sent', async () => {
    // This route sends a 200 response and then triggers an error.
    // Without res.headersSent check, the error handler crashes the process.
    const res = await request(app).get('/headers-sent');

    // We expect either a 200 (response already sent) or the server not to crash.
    expect(res.status).toBe(200);
  });
});
