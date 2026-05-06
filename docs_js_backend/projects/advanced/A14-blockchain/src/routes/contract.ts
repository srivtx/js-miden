import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { createContract, getContracts } from '../db.js';

const router = Router();

router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const { address, abi, bytecode } = req.body;
  const contract = createContract({
    id: crypto.randomUUID(),
    address,
    abi,
    bytecode,
    deployedAt: new Date(),
  });
  res.status(201).json(contract);
});

router.get('/', (_req, res) => {
  res.json(Array.from(getContracts().values()));
});

export { router as contractRouter };
