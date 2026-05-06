import { Router } from 'express';
import { streamVideo, getHlsManifest, getDashManifest, getSegment } from '../controllers/stream.controller.js';
import { rangeRequest } from '../middleware/range-request.middleware.js';

const router = Router();

router.get('/video/:id', rangeRequest, streamVideo);
router.get('/hls/:id/master.m3u8', getHlsManifest);
router.get('/dash/:id/manifest.mpd', getDashManifest);
router.get('/segment/:id/:variantId/:segmentName', getSegment);

export default router;
