import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('API integration', () => {
  it('healthcheck', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('submits metrics and retrieves them', async () => {
    await request(app)
      .post('/metrics')
      .send({ workloadId: 'wl-1', name: 'cpu', value: 55 });
    const res = await request(app).get('/metrics/wl-1');
    expect(res.status).toBe(200);
    expect(res.body.metrics).toHaveLength(1);
  });

  it('registers workload and evaluates scaling', async () => {
    await request(app)
      .post('/scaling/workloads')
      .send({ id: 'wl-1', currentReplicas: 2, minReplicas: 1, maxReplicas: 10, cpuRequest: 100, memoryRequest: 128 });
    await request(app)
      .post('/scaling/rules')
      .send({ workloadId: 'wl-1', threshold: 50, scaleUpStep: 1, scaleDownStep: 1, cooldownMs: 0 });
    await request(app)
      .post('/metrics')
      .send({ workloadId: 'wl-1', name: 'cpu', value: 80 });
    const res = await request(app)
      .post('/scaling/evaluate')
      .send({ workloadId: 'wl-1', mode: 'bug' });
    expect(res.status).toBe(200);
    expect(res.body.action).toBe('scale_up');
  });
});
