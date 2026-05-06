import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { jobQueue, deadLetterQueue } from '../src/services/queue.js';

describe('S28 Job Queue', () => {
  it('enqueues a job', async () => {
    const res = await request(app)
      .post('/jobs')
      .send({ type: 'email', payload: { to: 'a@b.com' } });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('retrieves job status', async () => {
    const enqueue = await request(app)
      .post('/jobs')
      .send({ type: 'image', payload: { file: 'img.jpg' } });
    const res = await request(app).get(`/jobs/${enqueue.body.id}`);
    expect(res.status).toBe(200);
  });

  it('BUG: timed out jobs are not marked as failed', async () => {
    // Simulate a job that will never complete (processor hangs)
    const res = await request(app)
      .post('/jobs')
      .send({ type: 'export', payload: { hang: true } });

    const jobId = res.body.id;
    // Wait a bit but less than any real timeout handling
    await new Promise((r) => setTimeout(r, 100));

    const statusRes = await request(app).get(`/jobs/${jobId}`);
    // Because there is no timeout handling, the job stays in active/waiting forever
    expect(['active', 'waiting', 'delayed']).toContain(statusRes.body.status);
    expect(statusRes.body.status).not.toBe('failed');
  });
});
