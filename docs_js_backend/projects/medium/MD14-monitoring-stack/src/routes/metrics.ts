import { Router } from 'express';
import { z } from 'zod';
import { recordMetric, getTimeSeries, queryTimeSeries } from '../services/metricStore.js';

const router = Router();

const recordSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['counter', 'gauge', 'histogram']),
  value: z.number(),
  labels: z.record(z.string()).default({}),
  timestamp: z.number().optional(),
});

router.post('/', (req, res, next) => {
  try {
    const body = recordSchema.parse(req.body);
    recordMetric(body.name, body.type, body.value, body.labels, body.timestamp);
    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:name', (req, res, next) => {
  try {
    const labels: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string') labels[k] = v;
    }
    const series = queryTimeSeries(req.params.name, labels);
    res.json({ data: series });
  } catch (err) {
    next(err);
  }
});

export default router;
