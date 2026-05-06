import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as orderService from '../services/orderService.js';
import { validateRequest } from '../middleware/validateRequest.js';

const checkoutSchema = z.object({
  body: z.object({
    idempotencyKey: z.string().min(1).max(255),
    shippingAddress: z.object({
      street: z.string(),
      city: z.string(),
      country: z.string(),
      postalCode: z.string(),
    }),
  }),
});

export const checkout = [
  validateRequest(checkoutSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' });

      const order = await orderService.createOrder(userId, req.body);
      res.status(201).json({ data: order });
    } catch (err) {
      next(err);
    }
  },
];

export const getOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' });

    const orders = await orderService.getOrdersByUser(userId);
    res.json({ data: orders });
  } catch (err) {
    next(err);
  }
};

export const getOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' });

    const order = await orderService.getOrderById(userId, req.params.id);
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
};
