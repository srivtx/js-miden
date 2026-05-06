import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { users } from '../db.js';
import type { User } from '../types.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const user: User = {
    id,
    username,
    email,
    passwordHash,
    followerCount: 0,
    createdAt: new Date(),
  };
  users.set(id, user);
  res.status(201).json({ id, username, email });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '7d' });
  res.json({ token });
});

export { router as authRouter };
