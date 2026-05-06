import { Router } from 'express';
import { startUpload, uploadChunk, finalizeUpload } from '../controllers/upload.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { z } from 'zod';

const router = Router({ mergeParams: true });

const startUploadSchema = z.object({
  body: z.object({
    videoId: z.string().uuid(),
    filename: z.string().min(1),
    mimeType: z.string(),
    size: z.number().positive(),
  }),
});

router.post('/start', validate(startUploadSchema), startUpload);
router.put('/:sessionId/chunk', uploadChunk);
router.post('/:sessionId/finalize', finalizeUpload);

export default router;
