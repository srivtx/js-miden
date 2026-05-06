import { Router } from 'express';
import crypto from 'crypto';

export const hashRouter = Router();

hashRouter.post('/hash', (req, res) => {
  const { password } = req.body;
  if (typeof password !== 'string') {
    res.status(400).json({ error: 'password required' });
    return;
  }

  // BUG: Using SHA-256 (fast, general-purpose hash) without a salt.
  // Password hashes should use slow, memory-hard algorithms like bcrypt or Argon2.
  // No salt means identical passwords always produce the same hash -> rainbow tables.
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  res.json({ hash });
});

hashRouter.post('/verify', (req, res) => {
  const { password, hash } = req.body;
  if (typeof password !== 'string' || typeof hash !== 'string') {
    res.status(400).json({ error: 'password and hash required' });
    return;
  }

  // BUG: Re-computing a fast, unsalted hash.
  const computed = crypto.createHash('sha256').update(password).digest('hex');

  // BUG: Standard string comparison is NOT constant-time.
  // An attacker can measure response-time differences to guess the hash byte-by-byte.
  const match = computed === hash;

  res.json({ match });
});
