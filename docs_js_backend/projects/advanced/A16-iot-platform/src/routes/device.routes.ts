import { Router } from 'express';
import { registerDevice, getDevice, listDevices, deleteDevice } from '../controllers/device.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    firmwareVersion: z.string(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

router.post('/', validate(registerSchema), registerDevice);
router.get('/', listDevices);
router.get('/:id', getDevice);
router.delete('/:id', deleteDevice);

export default router;
