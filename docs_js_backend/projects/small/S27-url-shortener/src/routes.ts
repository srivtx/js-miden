import { Router } from 'express';
import { createShortUrl, redirectShortUrl, getAnalytics } from './controller.js';
import { rateLimit } from 'express-rate-limit';

const router = Router();

const createLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true });

router.post('/shorten', createLimiter, createShortUrl);
router.get('/:shortCode', redirectShortUrl);
router.get('/:shortCode/stats', getAnalytics);

export { router as shortenerRouter };
