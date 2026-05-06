import { Router } from 'express';
import { sendNotification, updatePreferences, getPreferences } from './controller.js';

const router = Router();

router.post('/notify', sendNotification);
router.get('/preferences/:userId', getPreferences);
router.put('/preferences/:userId', updatePreferences);

export { router as notificationRouter };
