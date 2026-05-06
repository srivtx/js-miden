import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

describe('Job Board API', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM jobs').run();
  });

  it('creates a job', async () => {
    const res = await request(app)
      .post('/jobs')
      .send({
        title: 'Backend Engineer',
        company: 'Acme',
        location: 'Remote',
        salary_min: 100000,
        salary_max: 150000,
        type: 'full-time',
        remote: true,
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('lists jobs with filters', async () => {
    await request(app).post('/jobs').send({
      title: 'Frontend Dev',
      company: 'A',
      location: 'NYC',
      salary_min: 80,
      salary_max: 120,
      type: 'contract',
      remote: false,
    });
    await request(app).post('/jobs').send({
      title: 'Backend Dev',
      company: 'B',
      location: 'SF',
      salary_min: 120,
      salary_max: 180,
      type: 'full-time',
      remote: true,
    });

    const res = await request(app).get('/jobs?type=full-time&remote=true');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Backend Dev');
  });

  it('sorts by posted_date', async () => {
    await request(app).post('/jobs').send({ title: 'First', company: 'A', location: 'X', salary_min: 1, salary_max: 2, type: 'full-time', remote: false });
    await request(app).post('/jobs').send({ title: 'Second', company: 'B', location: 'Y', salary_min: 1, salary_max: 2, type: 'full-time', remote: false });
    const res = await request(app).get('/jobs?sort_by=posted_date&order=desc');
    expect(res.body[0].title).toBe('Second');
  });

  it('is vulnerable to SQL injection in type filter', async () => {
    await request(app).post('/jobs').send({
      title: 'Test',
      company: 'C',
      location: 'Z',
      salary_min: 1,
      salary_max: 2,
      type: 'full-time',
      remote: false,
    });
    // Injecting SQL to always match
    const res = await request(app).get("/jobs?type=' OR '1'='1");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('demonstrates float salary bug', async () => {
    await request(app).post('/jobs').send({
      title: 'Test',
      company: 'D',
      location: 'Z',
      salary_min: 99.99,
      salary_max: 199.99,
      type: 'full-time',
      remote: false,
    });
    const res = await request(app).get('/jobs');
    const job = res.body[0];
    // 99.99 cannot be represented exactly in binary floating point
    expect(job.salary_min).not.toBe(99.99);
  });
});
