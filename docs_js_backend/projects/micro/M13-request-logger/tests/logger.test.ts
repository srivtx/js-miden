import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Request Logger', () => {
  it('should log request details for every request', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await request(app).get('/health');

    expect(logSpy).toHaveBeenCalledTimes(1);

    const logArg = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logArg).toHaveProperty('method', 'GET');
    expect(logArg).toHaveProperty('path', '/health');
    expect(logArg).toHaveProperty('status', 200);
    expect(logArg).toHaveProperty('duration');
    expect(typeof logArg.duration).toBe('number');

    logSpy.mockRestore();
  });

  it('should NOT log sensitive fields like password', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await request(app).post('/login').send({ username: 'admin', password: 'secret' });

    const logArg = JSON.parse(logSpy.mock.calls[0][0] as string);

    // -----------------------------------------------------------------------
    // THIS ASSERTION FAILS DUE TO THE BUG:
    // The logger middleware serializes req.body directly into the log output.
    // Passwords and other sensitive fields are leaked in plain text.
    // A correct implementation should redact known sensitive fields.
    // -----------------------------------------------------------------------
    expect(logArg.body).not.toHaveProperty('password');

    logSpy.mockRestore();
  });
});
