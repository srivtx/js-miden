import { Router, Request, Response } from 'express';
import { getCart, addToCart, removeFromCart, mergeCartOnLogin } from './service.js';

export const router = Router();

router.get('/:cartId', async (req: Request, res: Response) => {
  const cart = await getCart(req.params.cartId as string);
  if (!cart) return res.status(404).json({ error: 'Cart not found' });
  res.json(cart);
});

router.post('/add', async (req: Request, res: Response) => {
  try {
    const cart = await addToCart(req.body);
    res.status(200).json(cart);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.delete('/:cartId/item/:productId', async (req: Request, res: Response) => {
  const cart = await removeFromCart(req.params.cartId as string, req.params.productId as string);
  if (!cart) return res.status(404).json({ error: 'Cart or item not found' });
  res.json(cart);
});

router.post('/merge', async (req: Request, res: Response) => {
  try {
    const cart = await mergeCartOnLogin(req.body.guestCartId, req.body.userCartId);
    res.status(200).json(cart);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
