import { Router } from 'express';
import { sendCommand, getPendingCommands, acknowledgeCommand, scheduleOta } from '../controllers/command.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { z } from 'zod';

const router = Router({ mergeParams: true });

const commandSchema = z.object({
  body: z.object({
    type: z.enum(['ota', 'reboot', 'config', 'custom']),
    payload: z.record(z.unknown()),
  }),
});

const otaSchema = z.object({
  body: z.object({
    firmwareUrl: z.string().url(),
    version: z.string(),
    checksum: z.string(),
    scheduledAt: z.string().datetime(),
  }),
});

router.post('/', authenticateAdmin, validate(commandSchema), sendCommand);
router.get('/pending', getPendingCommands);
router.post('/:commandId/ack', acknowledgeCommand);
router.post('/ota', authenticateAdmin, validate(otaSchema), scheduleOta);

export default router;
