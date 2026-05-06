import { storage } from './storage.js';
import { ContentItem } from './content.js';

export interface QueueJob {
  id: string;
  type: 'ai_check' | 'human_review' | 'publish';
  contentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  processedAt?: number;
  error?: string;
}

const jobQueue: QueueJob[] = [];

export async function enqueueJob(type: QueueJob['type'], contentId: string): Promise<QueueJob> {
  const job: QueueJob = {
    id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    contentId,
    status: 'pending',
    createdAt: Date.now(),
  };
  jobQueue.push(job);
  await storage.saveQueueJob(job);
  return job;
}

export async function getNextJob(): Promise<QueueJob | null> {
  const job = jobQueue.find(j => j.status === 'pending');
  return job || null;
}

export async function markJobProcessing(jobId: string): Promise<QueueJob | null> {
  const job = jobQueue.find(j => j.id === jobId);
  if (!job) return null;
  job.status = 'processing';
  await storage.saveQueueJob(job);
  return job;
}

export async function markJobCompleted(jobId: string): Promise<QueueJob | null> {
  const job = jobQueue.find(j => j.id === jobId);
  if (!job) return null;
  job.status = 'completed';
  job.processedAt = Date.now();
  await storage.saveQueueJob(job);
  return job;
}

export async function markJobFailed(jobId: string, error: string): Promise<QueueJob | null> {
  const job = jobQueue.find(j => j.id === jobId);
  if (!job) return null;
  job.status = 'failed';
  job.error = error;
  job.processedAt = Date.now();
  await storage.saveQueueJob(job);
  return job;
}
