import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { createOrder, getOrdersBySymbol, getOrderById, updateOrder } from '../db.js';
import { matchOrder } from '../services/matchingEngine.js';
import type { CreateOrderInput } from '../types.js';

const router = Router();

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const input = req.body as CreateOrderInput;
  const userId = req.userId!;

  // BUG: No price validation - accepts negative prices
  if (!input.symbol || !input.side || !input.type || !input.quantity) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const order = createOrder({
    id: crypto.randomUUID(),
    userId,
    symbol: input.symbol,
    side: input.side,
    type: input.type,
    price: input.price ?? 0,
    quantity: input.quantity,
    filledQuantity: 0,
    status: 'open',
    createdAt: new Date(),
  });

  if (order.type === 'market' || order.status === 'open') {
    await matchOrder(order);
    updateOrder(order);
  }

  res.status(201).json(order);
});

router.get('/:symbol', (req, res) => {
  const orders = getOrdersBySymbol(req.params.symbol);
  res.json(orders);
});

router.patch('/:id/cancel', authMiddleware, (req: AuthRequest, res) => {
  const order = getOrderById(req.params.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  if (order.userId !== req.userId) {
    res.status(403).json({ error: 'Not your order' });
    return;
  }
  if (order.status === 'filled') {
    res.status(400).json({ error: 'Already filled' });
    return;
  }
  order.status = 'cancelled';
  updateOrder(order);
  res.json(order);
});

export { router as ordersRouter };
