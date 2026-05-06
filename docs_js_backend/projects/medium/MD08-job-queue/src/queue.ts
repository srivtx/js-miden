import { Queue, Worker, Job as BullJob } from 'bullmq';
import IORedis from 'ioredis';

const redis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

export const videoQueue = new Queue('video-transcode', { connection: redis });

export async function addTranscodeJob(payload: object) {
  return videoQueue.add('transcode', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 10,
    removeOnFail: 5,
  });
}

export function createWorker(handler: (job: BullJob) => Promise<void>) {
  return new Worker('video-transcode', handler, {
    connection: redis,
    concurrency: 2,
  });
}
