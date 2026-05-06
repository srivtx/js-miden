import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/storage.js';
import { enqueueJob, getNextJob, markJobProcessing, markJobCompleted, markJobFailed } from '../src/queue.js';

describe('Queue', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should enqueue a job', async () => {
    const job = await enqueueJob('ai_check', 'content_1');
    expect(job.type).toBe('ai_check');
    expect(job.status).toBe('pending');
  });

  it('should retrieve next pending job', async () => {
    await enqueueJob('ai_check', 'content_1');
    await enqueueJob('human_review', 'content_2');
    const next = await getNextJob();
    expect(next).toBeDefined();
    expect(next!.status).toBe('pending');
  });

  it('should mark job as processing', async () => {
    const job = await enqueueJob('ai_check', 'content_1');
    const updated = await markJobProcessing(job.id);
    expect(updated!.status).toBe('processing');
  });

  it('should mark job as completed', async () => {
    const job = await enqueueJob('ai_check', 'content_1');
    await markJobProcessing(job.id);
    const updated = await markJobCompleted(job.id);
    expect(updated!.status).toBe('completed');
    expect(updated!.processedAt).toBeDefined();
  });

  it('should mark job as failed', async () => {
    const job = await enqueueJob('ai_check', 'content_1');
    const updated = await markJobFailed(job.id, 'AI service unavailable');
    expect(updated!.status).toBe('failed');
    expect(updated!.error).toBe('AI service unavailable');
  });
});
