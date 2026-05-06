import { Router } from 'express';
import { z } from 'zod';
import { createRule, getRules, getAlertStates, evaluateRules } from '../services/alertEngine.js';
import type { AlertRule } from '../types.js';

const router = Router();

const ruleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  metricName: z.string().min(1),
  labels: z.record(z.string()).default({}),
  condition: z.enum(['gt', 'lt', 'eq']),
  threshold: z.number(),
  durationMs: z.number().min(0).default(0),
  severity: z.enum(['warning', 'critical']).default('warning'),
});

router.post('/rules', (req, res, next) => {
  try {
    const body = ruleSchema.parse(req.body);
    createRule(body as AlertRule);
    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/rules', (_req, res) => {
  res.json({ data: getRules() });
});

router.get('/states', (_req, res) => {
  evaluateRules();
  res.json({ data: getAlertStates() });
});

export default router;
