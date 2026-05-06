import { Router } from 'express';
import { AuthController } from '../controllers/auth.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const controller = new AuthController();

router.post('/register', controller.register.bind(controller));
router.post('/login', controller.login.bind(controller));
router.get('/me', authenticate, controller.me.bind(controller));
router.get('/organization/users', authenticate, controller.getOrganizationUsers.bind(controller));
router.patch('/users/:id/role', authenticate, controller.updateRole.bind(controller));
router.post('/webhooks/stripe', controller.stripeWebhook.bind(controller));

export default router;
