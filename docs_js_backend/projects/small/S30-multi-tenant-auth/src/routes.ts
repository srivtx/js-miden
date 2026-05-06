import { Router } from 'express';
import { register, login, getProfile } from './controller.js';
import { authenticate, requireTenant } from './middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticate, requireTenant, getProfile);

export { router as authRouter };
