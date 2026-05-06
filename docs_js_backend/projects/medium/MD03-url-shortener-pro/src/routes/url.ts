import { Router } from 'express';
import * as urlController from '../controllers/urlController.js';

const router = Router();

router.post('/', urlController.createUrl);
router.get('/my', urlController.getUserUrls);
router.delete('/:shortCode', urlController.deleteUrl);

export default router;
