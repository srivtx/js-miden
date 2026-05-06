import { Queue, Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { emailProcessor, imageProcessor, exportProcessor } from './processors.js';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });

export const jobQueue = new Queue('jobQueue', { connection: redis });
export const deadLetterQueue = new Queue('deadLetterQueue', { connection: redis });

const worker = new Worker(
  'jobQueue',
  async (job: Job) => {
    // BUG: no timeout handling means stalled jobs never fail
    switch (job.data.type) {
      case 'email':
        return emailProcessor(job);
      case 'image':
        return imageProcessor(job);
      case 'export':
        return exportProcessor(job);
      default:
        throw new Error('Unknown job type');
    }
  },
  { connection: redis }
);

worker.on('failed', async (job, err) => {
  if (!job) return;
  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    await deadLetterQueue.add('failedJob', { ...job.data, error: err.message });
  }
});

export async function addJob(type: string, payload: any) {
  const job = await jobQueue.add(type, { type, payload }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });
  return job;
}

export async function getJob(id: string) {
  const job = await jobQueue.getJob(id);
  if (!job) return null;
  const state = await job.getState();
  return {
    id: job.id,
    status: state,
    progress: job.progress,
    result: job.returnvalue,
  };
}

export async function cancelJob(id: string) {
  const job = await jobQueue.getJob(id);
  if (job) {
    await job.discard();
    await job.moveToFailed(new Error('Cancelled by user'), '0', true);
  }
}
