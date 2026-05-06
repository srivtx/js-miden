import { Router } from 'express';
import { createVideo, getVideo, listVideos } from '../controllers/video.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { z } from 'zod';

const router = Router();

const createVideoSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000),
    duration: z.number().positive(),
    format: z.string(),
    size: z.number().positive(),
  }),
});

router.get('/', listVideos);
router.post('/', validate(createVideoSchema), createVideo);
router.get('/:id', getVideo);

export default router;
