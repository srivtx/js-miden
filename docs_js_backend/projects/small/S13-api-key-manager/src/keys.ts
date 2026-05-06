import { Router } from 'express';
import crypto from 'crypto';
import db from './db.js';

const router = Router();

function generateKey(): { prefix: string; fullKey: string } {
  const prefix = 'pk_live_';
  const random = crypto.randomBytes(32).toString('hex');
  return { prefix, fullKey: `${prefix}${random}` };
}

router.post('/', (req, res) => {
  const { name, scopes, rate_limit, expires_in_days } = req.body;
  const { prefix, fullKey } = generateKey();

  // BUG: Storing plaintext key instead of SHA-256 hash
  db.prepare(
    'INSERT INTO api_keys (prefix, key_hash, name, scopes, rate_limit, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    prefix,
    fullKey,
    name || null,
    scopes ? JSON.stringify(scopes) : null,
    rate_limit || 100,
    expires_in_days ? Date.now() + expires_in_days * 86400000 : null
  );

  res.status(201).json({ key: fullKey, name });
});

router.get('/', (req, res) => {
  const rows = db.prepare(
    'SELECT id, prefix, name, scopes, rate_limit, expires_at, revoked, created_at FROM api_keys WHERE revoked = 0'
  ).all();
  res.json({ keys: rows });
});

router.delete('/:id', (req, res) => {
  db.prepare('UPDATE api_keys SET revoked = 1 WHERE id = ?').run(req.params.id);
  res.json({ revoked: true });
});

export default router;
