import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';

const router = Router();

router.get('/stats', adminController.getAdminStats);
router.get('/analytics/:urlId', adminController.getUrlAnalytics);
router.post('/flush', adminController.flushAnalytics);

export default router;
