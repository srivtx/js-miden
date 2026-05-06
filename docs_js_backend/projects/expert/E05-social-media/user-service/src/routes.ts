import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  createdAt: string;
}

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

const users: Map<string, User> = new Map();
const follows: Map<string, Follow> = new Map();

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string };
}

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, username, password, displayName } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const user: User = {
      id,
      email,
      username,
      passwordHash,
      displayName: displayName || username,
      bio: '',
      avatarUrl: '',
      createdAt: new Date().toISOString(),
    };
    users.set(id, user);
    const token = generateToken(id);
    res.status(201).json({ user: { id, email, username, displayName: user.displayName }, token });
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
    res.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName }, token });
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
    res.json({ id: user.id, email: user.email, username: user.username, displayName: user.displayName, bio: user.bio, avatarUrl: user.avatarUrl });
  } catch (err) {
    next(err);
  }
});

router.patch('/profile', (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = verifyToken(auth.slice(7));
    const user = users.get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { displayName, bio, avatarUrl } = req.body;
    if (displayName) user.displayName = displayName;
    if (bio !== undefined) user.bio = bio;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    users.set(userId, user);
    res.json({ id: user.id, email: user.email, username: user.username, displayName: user.displayName, bio: user.bio, avatarUrl: user.avatarUrl });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const user = users.get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, username: user.username, displayName: user.displayName, bio: user.bio, avatarUrl: user.avatarUrl, createdAt: user.createdAt });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/follow', (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = verifyToken(auth.slice(7));
    const targetId = req.params.id;
    if (userId === targetId) return res.status(400).json({ error: 'Cannot follow yourself' });
    if (!users.has(targetId)) return res.status(404).json({ error: 'User not found' });
    const existing = Array.from(follows.values()).find((f) => f.followerId === userId && f.followingId === targetId);
    if (existing) return res.status(400).json({ error: 'Already following' });
    const follow: Follow = { id: uuidv4(), followerId: userId, followingId: targetId, createdAt: new Date().toISOString() };
    follows.set(follow.id, follow);
    res.status(201).json(follow);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/follow', (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = verifyToken(auth.slice(7));
    const targetId = req.params.id;
    const follow = Array.from(follows.values()).find((f) => f.followerId === userId && f.followingId === targetId);
    if (!follow) return res.status(404).json({ error: 'Not following' });
    follows.delete(follow.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/:id/followers', (req, res, next) => {
  try {
    const list = Array.from(follows.values()).filter((f) => f.followingId === req.params.id);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/following', (req, res, next) => {
  try {
    const list = Array.from(follows.values()).filter((f) => f.followerId === req.params.id);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

export { users, follows };
export default router;
