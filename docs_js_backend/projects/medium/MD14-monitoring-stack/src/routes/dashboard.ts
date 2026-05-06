import { Router } from 'express';
import { getAllSeries, getSeriesCount, pruneOldData } from '../services/metricStore.js';

const router = Router();

router.get('/series', (_req, res) => {
  res.json({
    data: {
      count: getSeriesCount(),
      series: getAllSeries().map((s) => ({
        name: s.name,
        labels: s.labels,
        valueCount: s.values.length,
      })),
    },
  });
});

router.post('/prune', (req, res) => {
  const hours = Number(req.query.hours) || 24;
  pruneOldData(hours);
  res.json({ success: true });
});

export default router;
