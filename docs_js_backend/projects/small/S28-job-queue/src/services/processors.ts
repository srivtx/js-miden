import { Job } from 'bullmq';

export async function emailProcessor(job: Job) {
  await job.updateProgress(10);
  // Simulate email sending
  await new Promise((resolve) => setTimeout(resolve, 200));
  await job.updateProgress(100);
  return { sent: true };
}

export async function imageProcessor(job: Job) {
  await job.updateProgress(20);
  // Simulate image processing
  await new Promise((resolve) => setTimeout(resolve, 300));
  await job.updateProgress(100);
  return { processed: true };
}

export async function exportProcessor(job: Job) {
  await job.updateProgress(50);
  // Simulate long export
  await new Promise((resolve) => setTimeout(resolve, 500));
  await job.updateProgress(100);
  return { url: '/exports/file.csv' };
}
