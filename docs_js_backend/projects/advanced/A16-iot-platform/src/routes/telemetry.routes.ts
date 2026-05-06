import { Router } from 'express';
import { ingestTelemetry, getTelemetry, getLatestTelemetry } from '../controllers/telemetry.controller.js';
import { authenticateDevice } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { z } from 'zod';

const router = Router();

const ingestSchema = z.object({
  body: z.object({
    deviceId: z.string().min(1),
    measurements: z.record(z.number()),
    tags: z.record(z.string()).optional(),
  }),
});

router.post('/', authenticateDevice, validate(ingestSchema), ingestTelemetry);
router.get('/latest/:deviceId', getLatestTelemetry);
router.get('/query', getTelemetry);

export default router;
