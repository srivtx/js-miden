import 'dotenv/config';
import { createWorker } from './queue.js';
import { transcodeVideo } from './services/transcode.js';
import { pool } from './db.js';
import type { Job } from 'bullmq';

const worker = createWorker(async (job: Job) => {
  const { jobId, inputPath, formats } = job.data;

  await pool.query(
    `UPDATE jobs SET status = 'processing', attempt_count = attempt_count + 1, updated_at = NOW() WHERE id = $1`,
    [jobId]
  );

  try {
    const result = await transcodeVideo(jobId, inputPath, formats);
    await pool.query(
      `UPDATE jobs SET status = 'completed', result = $1, progress = 100, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(result), jobId]
    );
  } catch (err) {
    const attemptResult = await pool.query(
      `SELECT attempt_count FROM jobs WHERE id = $1`,
      [jobId]
    );
    const attempts = attemptResult.rows[0]?.attempt_count || 1;

    if (attempts >= 3) {
      // Dead letter queue behavior
      await pool.query(
        `UPDATE jobs SET status = 'dead', error = $1, updated_at = NOW() WHERE id = $2`,
        [(err as Error).message, jobId]
      );
      throw err; // Let BullMQ know this failed permanently
    } else {
      await pool.query(
        `UPDATE jobs SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2`,
        [(err as Error).message, jobId]
      );
      throw err; // Trigger retry
    }
  }
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

console.log('MD08 Worker started');
