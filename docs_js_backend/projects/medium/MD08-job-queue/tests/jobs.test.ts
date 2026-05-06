import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { initDb, resetDb, pool } from '../src/db.js';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await pool.end();
});

describe('POST /api/jobs', () => {
  it('creates a transcode job', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({ type: 'video.transcode', payload: { inputPath: 'video.mp4', formats: ['720p', '1080p'] } });
    expect(res.status).toBe(202);
    expect(res.body.jobId).toBeDefined();
  });

  it('returns cached result for completed duplicate', async () => {
    const payload = { inputPath: 'dup.mp4', formats: ['720p'] };
    const first = await request(app).post('/api/jobs').send({ type: 'video.transcode', payload });
    const jobId = first.body.jobId;

    // Simulate completion
    await pool.query(
      `UPDATE jobs SET status = 'completed', result = $1 WHERE id = $2`,
      [JSON.stringify({ outputs: ['dup.mp4.720p'] }), jobId]
    );

    const second = await request(app).post('/api/jobs').send({ type: 'video.transcode', payload });
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
  });
});

describe('GET /api/jobs/:id', () => {
  it('returns job details', async () => {
    const create = await request(app)
      .post('/api/jobs')
      .send({ type: 'video.transcode', payload: { inputPath: 'a.mp4', formats: ['720p'] } });

    const res = await request(app).get(`/api/jobs/${create.body.jobId}`);
    expect(res.status).toBe(200);
    expect(res.body.job.status).toBe('pending');
  });
});

describe('GET /api/jobs/:id/progress', () => {
  it('returns progress', async () => {
    const create = await request(app)
      .post('/api/jobs')
      .send({ type: 'video.transcode', payload: { inputPath: 'b.mp4', formats: ['720p'] } });

    const res = await request(app).get(`/api/jobs/${create.body.jobId}/progress`);
    expect(res.status).toBe(200);
    expect(res.body.progress).toBe(0);
  });
});
