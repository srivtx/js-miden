import { Router } from 'express';
import { createRule, listRules, getEvents } from '../controllers/alert.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { z } from 'zod';

const router = Router();

const ruleSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    deviceId: z.string().optional(),
    deviceType: z.string().optional(),
    condition: z.object({
      measurement: z.string(),
      operator: z.enum(['gt', 'lt', 'eq', 'ne', 'gte', 'lte']),
      threshold: z.number(),
      duration: z.number().optional(),
    }),
    actions: z.array(z.object({
      type: z.enum(['webhook', 'email', 'sms', 'mqtt']),
      target: z.string(),
      payload: z.record(z.unknown()).optional(),
    })),
    enabled: z.boolean(),
  }),
});

router.post('/', authenticateAdmin, validate(ruleSchema), createRule);
router.get('/', listRules);
router.get('/events/:deviceId', getEvents);

export default router;
