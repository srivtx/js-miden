import { Request, Response, NextFunction } from 'express';
import { streamService } from '../services/stream.service.js';
import { cdnService } from '../services/cdn.service.js';
import { logger } from '../utils/logger.js';

export async function streamVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const rangeHeader = req.headers.range as string | undefined;

    const { stream, start, end, totalSize, contentType } = await streamService.streamVideo(id, rangeHeader);

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      ...cdnService.getCacheHeaders(),
    };

    if (rangeHeader) {
      res.status(206);
      headers['Content-Range'] = `bytes ${start}-${end}/${totalSize}`;
      headers['Content-Length'] = String(end - start + 1);
    } else {
      headers['Content-Length'] = String(totalSize);
    }

    res.set(headers);
    (stream as any).pipe(res);
    logger.info({ videoId: id, start, end }, 'Video stream started');
  } catch (err) {
    next(err);
  }
}

export async function getHlsManifest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const manifest = await streamService.getHlsManifest(id);
    res.set('Content-Type', manifest.contentType);
    res.send(manifest.content);
  } catch (err) {
    next(err);
  }
}

export async function getDashManifest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const manifest = await streamService.getDashManifest(id);
    res.set('Content-Type', manifest.contentType);
    res.send(manifest.content);
  } catch (err) {
    next(err);
  }
}

export async function getSegment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, variantId, segmentName } = req.params;
    const { data, contentType } = await streamService.getSegment(id, variantId, segmentName);
    res.set('Content-Type', contentType);
    res.set(cdnService.getCacheHeaders());
    res.send(data);
  } catch (err) {
    next(err);
  }
}
