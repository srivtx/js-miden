import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as cartService from '../services/cartService.js';
import { validateRequest } from '../middleware/validateRequest.js';

const addItemSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
  }),
});

const updateItemSchema = z.object({
  body: z.object({
    quantity: z.number().int().min(1),
  }),
  params: z.object({
    itemId: z.string().uuid(),
  }),
});

export const addItem = [
  validateRequest(addItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' });

      const item = await cartService.addItemToCart(userId, req.body);
      res.status(201).json({ data: item });
    } catch (err) {
      next(err);
    }
  },
];

export const removeItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' });

    await cartService.removeItemFromCart(userId, req.params.itemId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const updateItem = [
  validateRequest(updateItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' });

      const item = await cartService.updateCartItemQuantity(userId, req.params.itemId, req.body.quantity);
      res.json({ data: item });
    } catch (err) {
      next(err);
    }
  },
];

export const getCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' });

    const cart = await cartService.getCartWithTotals(userId);
    res.json({ data: cart });
  } catch (err) {
    next(err);
  }
};

export const clearCart = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' });

    await cartService.clearCart(userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
