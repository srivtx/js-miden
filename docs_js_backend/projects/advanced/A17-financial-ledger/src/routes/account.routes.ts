import { Router } from 'express';
import { createAccount, getAccount, getBalance, listAccounts } from '../controllers/account.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { createAccountSchema } from '../utils/validator.js';

const router = Router();

router.post('/', validate(createAccountSchema), createAccount);
router.get('/', listAccounts);
router.get('/:id', getAccount);
router.get('/:id/balance', getBalance);

export default router;
