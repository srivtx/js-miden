import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { storage } from '../src/storage.js';

describe('Integration', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should submit content and run AI check', async () => {
    const submitRes = await request(app)
      .post('/content/submit')
      .send({ userId: 'user_1', text: 'Buy now! Spam!' });
    expect(submitRes.status).toBe(201);
    const content = submitRes.body;

    const aiRes = await request(app).post(`/content/${content.id}/ai-check`);
    expect(aiRes.status).toBe(200);
    expect(aiRes.body.result.flagged).toBe(true);

    const getRes = await request(app).get(`/content/${content.id}`);
    expect(getRes.body.status).toBe('human_review');
  });

  it('should complete full pipeline: submit → ai → human → publish', async () => {
    const submitRes = await request(app)
      .post('/content/submit')
      .send({ userId: 'user_1', text: 'Buy now! Spam!' });
    const content = submitRes.body;

    await request(app).post(`/content/${content.id}/ai-check`);
    const pendingRes = await request(app).get('/reviews/pending');
    expect(pendingRes.body.length).toBe(1);

    await request(app)
      .post(`/content/${content.id}/review`)
      .send({ reviewerId: 'rev_1', decision: 'approved', reason: 'Not spam' });

    const publishRes = await request(app).post(`/content/${content.id}/publish`);
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.status).toBe('published');
  });

  it('should handle appeal workflow', async () => {
    const submitRes = await request(app)
      .post('/content/submit')
      .send({ userId: 'user_1', text: 'Spam!' });
    const content = submitRes.body;

    await request(app).post(`/content/${content.id}/ai-check`);
    await request(app)
      .post(`/content/${content.id}/review`)
      .send({ reviewerId: 'rev_1', decision: 'rejected', reason: 'Spam' });

    const appealRes = await request(app)
      .post(`/content/${content.id}/appeal`)
      .send({ userId: 'user_1', reason: 'Unfair' });
    expect(appealRes.status).toBe(201);

    const processRes = await request(app)
      .post(`/appeals/${appealRes.body.id}/process`)
      .send({ resolverId: 'admin_1', approved: true });
    expect(processRes.status).toBe(200);

    const auditRes = await request(app).get(`/content/${content.id}/audit`);
    expect(auditRes.body.length).toBeGreaterThanOrEqual(4);
  });

  it('should enqueue and process queue jobs', async () => {
    const submitRes = await request(app)
      .post('/content/submit')
      .send({ userId: 'user_1', text: 'Hello' });
    const content = submitRes.body;

    const enqueueRes = await request(app)
      .post('/queue/enqueue')
      .send({ type: 'ai_check', contentId: content.id });
    expect(enqueueRes.status).toBe(201);

    const nextRes = await request(app).get('/queue/next');
    expect(nextRes.body).toBeDefined();
    expect(nextRes.body.contentId).toBe(content.id);
  });
});
