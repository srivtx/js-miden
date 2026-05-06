import { spawn } from 'child_process';
import { pool } from '../db.js';

export async function transcodeVideo(jobId: string, inputPath: string, formats: string[]) {
  const outputs: string[] = [];

  for (let i = 0; i < formats.length; i++) {
    const format = formats[i];
    const outputPath = `${inputPath}.${format}`;

    // Track progress in DB for polling
    await pool.query(
      `UPDATE jobs SET progress = $1, updated_at = NOW() WHERE id = $2`,
      [Math.round(((i) / formats.length) * 100), jobId]
    );

    // Simulate ffmpeg with a spawned process
    await runFfmpeg(inputPath, outputPath, format);
    outputs.push(outputPath);

    await pool.query(
      `UPDATE jobs SET progress = $1, updated_at = NOW() WHERE id = $2`,
      [Math.round(((i + 1) / formats.length) * 100), jobId]
    );
  }

  return { outputs };
}

function runFfmpeg(input: string, output: string, format: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Simulate ffmpeg with a short sleep process
    const proc = spawn('sleep', ['0.1']);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

// BUGGY: No cleanup on crash - ffmpeg processes become zombies if worker dies
export async function transcodeVideoNoCleanup(jobId: string, inputPath: string, formats: string[]) {
  const outputs: string[] = [];
  for (const format of formats) {
    const outputPath = `${inputPath}.${format}`;
    const proc = spawn('sleep', ['10']); // Long-running process
    // No tracking of proc PID, no cleanup on crash
    await new Promise((resolve) => proc.on('close', resolve));
    outputs.push(outputPath);
  }
  return { outputs };
}
