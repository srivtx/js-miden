import request from 'supertest';
import { app, breaker } from '../src/index.js';

describe('Circuit Breaker', () => {
  beforeEach(async () => {
    // Reset breaker state and set external API to fail
    await request(app).post('/simulate/fail').send({ fail: true });
    // Create fresh breaker instance by accessing internals
    (breaker as any).state = 'closed';
    (breaker as any).failures = [];
    (breaker as any).lastOpenTime = 0;
    (breaker as any).halfOpenAttempts = 0;
  });

  afterEach(async () => {
    await request(app).post('/simulate/fail').send({ fail: false });
  });

  it('should return success when external API works', async () => {
    await request(app).post('/simulate/fail').send({ fail: false });
    const res = await request(app).get('/api/external');
    expect(res.status).toBe(200);
    expect(res.body.data).toBe('success');
  });

  it('should open circuit after 5 failures in 60s', async () => {
    // Trigger 5 failures
    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/external');
    }

    // 6th request should get 503 because circuit is open
    const res = await request(app).get('/api/external');
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('OPEN');
  });

  it('should track failure count in metrics', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/external');
    }

    const health = await request(app).get('/health');
    expect(health.body.metrics.failuresInWindow).toBe(3);
  });

  it('should transition to half-open after timeout', async () => {
    // Speed up time for test
    const originalTimeout = (breaker as any).options.halfOpenTimeoutMs;
    (breaker as any).options.halfOpenTimeoutMs = 100;

    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/external');
    }

    // Wait for half-open timeout
    await new Promise(r => setTimeout(r, 150));

    const health = await request(app).get('/health');
    expect(health.body.state).toBe('half-open');

    (breaker as any).options.halfOpenTimeoutMs = originalTimeout;
  });

  it('should close circuit after successful half-open request', async () => {
    const originalTimeout = (breaker as any).options.halfOpenTimeoutMs;
    (breaker as any).options.halfOpenTimeoutMs = 100;

    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/external');
    }

    await new Promise(r => setTimeout(r, 150));
    await request(app).post('/simulate/fail').send({ fail: false });

    // Half-open request succeeds
    const res = await request(app).get('/api/external');
    expect(res.status).toBe(200);

    // Circuit should be closed
    const health = await request(app).get('/health');
    expect(health.body.state).toBe('closed');

    (breaker as any).options.halfOpenTimeoutMs = originalTimeout;
  });
});
