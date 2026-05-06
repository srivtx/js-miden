import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { createWallet, getWalletById } from '../db.js';

const router = Router();

router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const wallet = createWallet({
    id: crypto.randomUUID(),
    userId: req.userId!,
    address: '0x' + Math.random().toString(16).slice(2, 42),
    balance: '1000000000000000000',
    nonce: 0,
    createdAt: new Date(),
  });
  res.status(201).json(wallet);
});

router.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  const wallet = getWalletById(req.params.id);
  if (!wallet || wallet.userId !== req.userId) {
    res.status(404).json({ error: 'Wallet not found' });
    return;
  }
  res.json(wallet);
});

export { router as walletRouter };
