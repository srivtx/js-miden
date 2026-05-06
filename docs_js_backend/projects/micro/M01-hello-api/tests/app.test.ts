import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { requestLogger } from '../src/middleware/logger.js';

/**
 * Helper to create a Pino logger that writes into an in-memory array.
 * This lets us assert on the exact JSON that would be sent to stdout.
 */
function createTestLogger() {
  const logs: Record<string, unknown>[] = [];
  const stream = {
    write: (msg: string) => {
      logs.push(JSON.parse(msg));
    },
  };
  return { logger: pino({ level: 'info' }, stream), logs };
}

describe('Hello API', () => {
  it('GET / returns "Hello, World!"', async () => {
    const app = createApp();
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toBe('Hello, World!');
  });

  it('GET /health returns status ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('logs every request with structured fields', async () => {
    const { logger, logs } = createTestLogger();
    const app = express();
    app.use(requestLogger(logger));
    app.get('/test', (_req, res) => res.status(201).send('created'));

    await request(app).get('/test');

    expect(logs).toHaveLength(1);
    const log = logs[0];
    expect(log).toHaveProperty('requestId');
    expect(log).toHaveProperty('method', 'GET');
    expect(log).toHaveProperty('path', '/test');
    expect(log).toHaveProperty('statusCode', 201);
    expect(log).toHaveProperty('durationMs');
    expect(log).toHaveProperty('timestamp');
  });

  // THIS TEST FAILS BECAUSE OF THE BUG in src/middleware/logger.ts
  // The startTime is captured when requestLogger() is called, not per-request.
  // If we wait 50ms before making the request, the logged duration includes
  // that idle wait time, making it much larger than the actual handler time.
  it('logs response time under 20ms for a fast handler', async () => {
    const { logger, logs } = createTestLogger();
    const app = express();
    app.use(requestLogger(logger));
    app.get('/fast', (_req, res) => res.send('ok'));

    // Wait to expose the bug: duration should NOT include idle time
    await new Promise((r) => setTimeout(r, 50));

    await request(app).get('/fast');

    expect(logs).toHaveLength(1);
    const duration = logs[0].durationMs as number;

    // The handler itself is instant; duration should be tiny
    expect(duration).toBeGreaterThanOrEqual(0);
    expect(duration).toBeLessThan(20);
  });
});
