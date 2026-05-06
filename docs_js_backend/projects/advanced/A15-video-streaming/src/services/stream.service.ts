import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { StreamResponse, Manifest } from '../types/stream.types.js';
import { parseRange } from '../utils/range.utils.js';
import { getFileSize, getVideoPath } from '../utils/file.utils.js';
import { logger } from '../utils/logger.js';

export class StreamService {
  async streamVideo(videoId: string, rangeHeader?: string): Promise<StreamResponse> {
    const videoPath = getVideoPath(videoId, 'source.mp4', config.storagePath);
    const totalSize = await getFileSize(videoPath);
    const contentType = 'video/mp4';

    let start = 0;
    let end = totalSize - 1;

    if (rangeHeader) {
      const range = parseRange(rangeHeader, totalSize);
      if (range) {
        start = range.start;
        end = range.end;
      }
    }

    // BUG: No validation of range size. Client can request 0-totalSize causing memory issues.
    const chunkSize = end - start + 1;
    logger.info({ videoId, start, end, chunkSize }, 'Streaming video');

    const stream = fs.createReadStream(videoPath, { start, end });

    return {
      stream: stream as unknown as ReadableStream,
      start,
      end,
      totalSize,
      contentType,
    };
  }

  async getHlsManifest(videoId: string): Promise<Manifest> {
    const manifestPath = getVideoPath(videoId, 'master.m3u8', config.storagePath);
    const content = await fs.promises.readFile(manifestPath, 'utf-8');
    return {
      type: 'hls',
      content,
      contentType: 'application/vnd.apple.mpegurl',
    };
  }

  async getDashManifest(videoId: string): Promise<Manifest> {
    const manifestPath = getVideoPath(videoId, 'manifest.mpd', config.storagePath);
    const content = await fs.promises.readFile(manifestPath, 'utf-8');
    return {
      type: 'dash',
      content,
      contentType: 'application/dash+xml',
    };
  }

  async getSegment(videoId: string, variantId: string, segmentName: string): Promise<{ data: Buffer; contentType: string }> {
    const segmentPath = path.join(config.storagePath, videoId, variantId, segmentName);
    const data = await fs.promises.readFile(segmentPath);
    const ext = path.extname(segmentName);
    const contentType = ext === '.ts' ? 'video/MP2T' : ext === '.m4s' ? 'video/iso.segment' : 'application/octet-stream';
    return { data, contentType };
  }
}

export const streamService = new StreamService();
