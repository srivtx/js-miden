import { Router } from 'express';
import { createTransaction, getTransaction, postTransaction, reverseTransaction } from '../controllers/transaction.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { createTransactionSchema } from '../utils/validator.js';

const router = Router();

router.post('/', validate(createTransactionSchema), createTransaction);
router.get('/:id', getTransaction);
router.post('/:id/post', postTransaction);
router.post('/:id/reverse', reverseTransaction);

export default router;
