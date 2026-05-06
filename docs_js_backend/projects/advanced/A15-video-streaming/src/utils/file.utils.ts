import fs from 'fs/promises';
import path from 'path';
import { logger } from './logger.js';

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    logger.info(`Creating directory: ${dirPath}`);
    await fs.mkdir(dirPath, { recursive: true });
  }
}

export async function getFileSize(filePath: string): Promise<number> {
  const stat = await fs.stat(filePath);
  return stat.size;
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}

export function getVideoPath(videoId: string, filename: string, storagePath: string): string {
  return path.join(storagePath, videoId, filename);
}
