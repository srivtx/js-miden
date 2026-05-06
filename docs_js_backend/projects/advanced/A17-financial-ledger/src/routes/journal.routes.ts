import { Router } from 'express';
import { getJournalEntries, verifyLedger, getAuditLogs, verifyAuditChain } from '../controllers/journal.controller.js';

const router = Router();

router.get('/entries/:transactionId', getJournalEntries);
router.get('/verify', verifyLedger);
router.get('/audit', getAuditLogs);
router.get('/audit/verify', verifyAuditChain);

export default router;
