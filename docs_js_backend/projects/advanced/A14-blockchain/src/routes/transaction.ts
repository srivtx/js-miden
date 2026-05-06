import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { getWalletByAddress, createTransaction, getTransactionByHash } from '../db.js';
import { getNonce, incrementNonce } from '../services/nonceManager.js';
import { signTransaction } from '../services/signer.js';
import { broadcastTransaction } from '../services/blockchain.js';
import type { Transaction } from '../types.js';

const router = Router();

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const { from, to, value, gasPrice, gasLimit, data, privateKey } = req.body;

  const wallet = getWalletByAddress(from);
  if (!wallet) {
    res.status(404).json({ error: 'Wallet not found' });
    return;
  }

  // BUG: No confirmation waiting - returns success before tx is confirmed
  // Also BUG: Nonce reuse possible under concurrency
  const nonce = await getNonce(from);
  await incrementNonce(from);

  const txData: Omit<Transaction, 'id' | 'hash' | 'signature' | 'status' | 'createdAt'> = {
    from,
    to,
    value,
    nonce,
    gasPrice,
    gasLimit,
    data: data || '0x',
  };

  const signature = signTransaction(txData, privateKey);
  const hash = '0x' + Math.random().toString(16).slice(2);

  const tx: Transaction = {
    id: crypto.randomUUID(),
    hash,
    ...txData,
    signature,
    status: 'pending',
    createdAt: new Date(),
  };

  await broadcastTransaction(tx);

  // BUG: Returns 200 immediately without waiting for confirmation
  // The transaction may fail later (out of gas, revert, etc.)
  res.status(200).json({ success: true, transaction: tx });
});

router.get('/:hash', (req, res) => {
  const tx = getTransactionByHash(req.params.hash);
  if (!tx) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }
  res.json(tx);
});

export { router as transactionRouter };
