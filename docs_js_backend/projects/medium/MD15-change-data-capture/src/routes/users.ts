import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../services/db.js';
import { getNextLsn, publishChange } from '../services/walReader.js';
import type { ChangeEvent } from '../types.js';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

router.post('/', async (req, res, next) => {
  try {
    const body = createUserSchema.parse(req.body);
    const result = await query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
      [body.email, body.name]
    );
    const user = result.rows[0];

    const event: ChangeEvent = {
      lsn: await getNextLsn(),
      table: 'users',
      operation: 'INSERT',
      before: null,
      after: user,
      timestamp: Date.now(),
    };
    await publishChange(event);

    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name } = req.body;
    const beforeResult = await query('SELECT * FROM users WHERE id = $1', [id]);
    const before = beforeResult.rows[0];
    if (!before) {
      res.status(404).json({ error: { code: 'NOT_FOUND' } });
      return;
    }

    const result = await query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING *',
      [name, id]
    );
    const after = result.rows[0];

    const event: ChangeEvent = {
      lsn: await getNextLsn(),
      table: 'users',
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

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const beforeResult = await query('SELECT * FROM users WHERE id = $1', [id]);
    const before = beforeResult.rows[0];
    if (!before) {
      res.status(404).json({ error: { code: 'NOT_FOUND' } });
      return;
    }

    await query('DELETE FROM users WHERE id = $1', [id]);

    const event: ChangeEvent = {
      lsn: await getNextLsn(),
      table: 'users',
      operation: 'DELETE',
      before,
      after: null,
      timestamp: Date.now(),
    };
    await publishChange(event);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM users ORDER BY id');
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
