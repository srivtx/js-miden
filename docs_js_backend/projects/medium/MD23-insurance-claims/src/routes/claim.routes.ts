import { Router } from 'express';
import { ClaimController } from '../controllers/claim.controller.js';

const router = Router();
const controller = new ClaimController();

router.post('/', controller.submitClaim);
router.get('/', controller.listClaims);
router.get('/:id', controller.getClaim);
router.post('/:id/review', controller.moveToReview);
router.post('/:id/assign', controller.assignAdjuster);
router.post('/:id/decision', controller.makeDecision);
router.post('/:id/pay', controller.processPayment);
router.post('/:id/documents', controller.uploadDocument);

export { router as claimRoutes };
