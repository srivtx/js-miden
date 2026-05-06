import { Router, Request, Response } from 'express';
import { getWishlist, addItem, removeItem, checkPriceChanges } from './service.js';

export const router = Router();

router.get('/:userId', async (req: Request, res: Response) => {
  const items = await getWishlist(req.params.userId as string);
  res.json(items);
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const item = await addItem(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.delete('/:userId/:itemId', async (req: Request, res: Response) => {
  const removed = await removeItem(req.params.userId as string, req.params.itemId as string);
  if (!removed) return res.status(404).json({ error: 'Item not found' });
  res.status(204).send();
});

router.get('/:userId/price-changes', async (req: Request, res: Response) => {
  const changes = await checkPriceChanges(req.params.userId as string);
  res.json(changes);
});
