import { Router } from 'express';
import { cache } from './cache.js';

const router = Router();

// POST /cache - Store key/value
router.post('/', (req, res) => {
  const { key, value } = req.body as { key?: string; value?: unknown };

  if (typeof key !== 'string' || key.length === 0) {
    res.status(400).json({ error: 'key is required and must be a non-empty string' });
    return;
  }

  if (value === undefined) {
    res.status(400).json({ error: 'value is required' });
    return;
  }

  cache.set(key, value);
  res.status(201).json({ key, value, ttl: 60 });
});

// GET /cache/:key - Retrieve value
router.get('/:key', (req, res) => {
  const { key } = req.params;
  const value = cache.get(key);

  if (value === undefined) {
    res.status(404).json({ error: 'Key not found or expired' });
    return;
  }

  res.json({ key, value });
});

// DELETE /cache/:key - Remove key
router.delete('/:key', (req, res) => {
  const { key } = req.params;
  const existed = cache.delete(key);

  if (!existed) {
    res.status(404).json({ error: 'Key not found' });
    return;
  }

  res.status(204).send();
});

export default router;
