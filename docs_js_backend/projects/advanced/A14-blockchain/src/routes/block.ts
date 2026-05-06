import { Router } from 'express';
import { getBlocks, getTransactions } from '../db.js';

const router = Router();

router.get('/latest', (_req, res) => {
  const blocks = Array.from(getBlocks().values()).sort((a, b) => b.number - a.number);
  res.json(blocks.slice(0, 10));
});

router.get('/:number', (req, res) => {
  const block = getBlocks().get(parseInt(req.params.number));
  if (!block) {
    res.status(404).json({ error: 'Block not found' });
    return;
  }
  res.json(block);
});

router.get('/:number/transactions', (req, res) => {
  const block = getBlocks().get(parseInt(req.params.number));
  if (!block) {
    res.status(404).json({ error: 'Block not found' });
    return;
  }
  const txs = Array.from(getTransactions().values()).filter(t => block.transactions.includes(t.hash));
  res.json(txs);
});

export { router as blockRouter };
