import { Router } from 'express';
import { z } from 'zod';
import { query } from '../services/db.js';
import { getNextLsn, publishChange } from '../services/walReader.js';
import type { ChangeEvent } from '../types.js';

const router = Router();

const createOrderSchema = z.object({
  user_id: z.number().int(),
  total_cents: z.number().int().min(0),
});

router.post('/', async (req, res, next) => {
  try {
    const body = createOrderSchema.parse(req.body);
    const result = await query(
      'INSERT INTO orders (user_id, total_cents, status) VALUES ($1, $2, $3) RETURNING *',
      [body.user_id, body.total_cents, 'pending']
    );
    const order = result.rows[0];

    const event: ChangeEvent = {
      lsn: await getNextLsn(),
      table: 'orders',
      operation: 'INSERT',
      before: null,
      after: order,
      timestamp: Date.now(),
    };
    await publishChange(event);

    res.status(201).json({ data: order });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const beforeResult = await query('SELECT * FROM orders WHERE id = $1', [id]);
    const before = beforeResult.rows[0];
    if (!before) {
      res.status(404).json({ error: { code: 'NOT_FOUND' } });
      return;
    }

    const result = await query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    const after = result.rows[0];

    const event: ChangeEvent = {
      lsn: await getNextLsn(),
      table: 'orders',
      operation: 'UPDATE',
      before,
      after,
      timestamp: Date.now(),
    };
    await publishChange(event);

    res.json({ data: after });
  } catch (err) {
    next(err);
  }
});

export default router;
