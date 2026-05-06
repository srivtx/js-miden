import { Router } from 'express';
import { submitMetric, listMetrics, latestMetric } from '../controllers/metricsController.js';

const router = Router();
router.post('/', submitMetric);
router.get('/:workloadId', listMetrics);
router.get('/:workloadId/latest', latestMetric);

export default router;
