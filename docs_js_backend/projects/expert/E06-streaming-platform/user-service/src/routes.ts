import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  profiles: Profile[];
  createdAt: string;
}

export interface Profile {
  id: string;
  name: string;
  avatarUrl: string;
  isKids: boolean;
  maturityLevel: 'all' | '7+' | '13+' | '16+' | '18+';
}

const users: Map<string, User> = new Map();

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string };
}

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const user: User = {
      id,
      email,
      passwordHash,
      displayName: displayName || email,
      profiles: [],
      createdAt: new Date().toISOString(),
    };
    users.set(id, user);
    const token = generateToken(id);
    res.status(201).json({ user: { id, email, displayName: user.displayName }, token });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = Array.from(users.values()).find((u) => u.email === email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = generateToken(user.id);
    res.json({ user: { id: user.id, email: user.email, displayName: user.displayName }, token });
  } catch (err) {
    next(err);
  }
});

router.get('/me', (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = verifyToken(auth.slice(7));
    const user = users.get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, email: user.email, displayName: user.displayName, profiles: user.profiles });
  } catch (err) {
    next(err);
  }
});

router.post('/profiles', (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = verifyToken(auth.slice(7));
    const user = users.get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name, isKids, maturityLevel } = req.body;
    const profile: Profile = {
      id: uuidv4(),
      name: name || 'Profile',
      avatarUrl: '',
      isKids: isKids || false,
      maturityLevel: maturityLevel || 'all',
    };
    user.profiles.push(profile);
    users.set(userId, user);
    res.status(201).json(profile);
  } catch (err) {
    next(err);
  }
});

export { users };
export default router;
