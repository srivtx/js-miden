import { Router } from 'express';
import { getTradesBySymbol } from '../db.js';

const router = Router();

router.get('/:symbol', (req, res) => {
  const trades = getTradesBySymbol(req.params.symbol);
  res.json(trades);
});

export { router as tradesRouter };
