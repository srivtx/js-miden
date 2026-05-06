import { logger } from '../utils/logger.js';
import { videoService } from './video.service.js';

export interface UploadResult {
  sessionId: string;
  videoId: string;
  url: string;
}

export class UploadService {
  async startUpload(videoId: string, filename: string, mimeType: string, size: number): Promise<UploadResult> {
    logger.info({ videoId, filename, size }, 'Starting upload');
    const session = await videoService.createUploadSession(videoId, filename, mimeType, size);
    return {
      sessionId: session.id,
      videoId,
      url: `/api/videos/${videoId}/upload/${session.id}`,
    };
  }

  async processChunk(sessionId: string, chunk: Buffer): Promise<void> {
    const session = await videoService.getUploadSession(sessionId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    // In production: write chunk to temporary file
    logger.debug({ sessionId, chunkSize: chunk.length }, 'Processing chunk');
    await videoService.updateUploadProgress(sessionId, chunk.length);
  }

  async finalizeUpload(sessionId: string): Promise<void> {
    const session = await videoService.getUploadSession(sessionId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    logger.info({ sessionId, videoId: session.videoId }, 'Finalizing upload');
    await videoService.updateStatus(session.videoId, 'processing');

    // Trigger transcoding
    // In production: enqueue transcoding job
  }
}

export const uploadService = new UploadService();
