import { Router } from 'express';
import { setExchangeRate, convertCurrency, getTrialBalance } from '../controllers/report.controller.js';

const router = Router();

router.post('/exchange-rate', setExchangeRate);
router.post('/convert', convertCurrency);
router.get('/trial-balance', getTrialBalance);

export default router;
