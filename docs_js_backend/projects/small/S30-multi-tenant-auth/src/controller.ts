import { Request, Response } from 'express';
import { registerUser, loginUser, getUserProfile } from './services/auth.js';

export async function register(req: Request, res: Response) {
  try {
    const { email, password, tenantId } = req.body;
    if (!email || !password || !tenantId) return res.status(400).json({ error: 'Missing fields' });

    const user = await registerUser(email, password, tenantId);
    return res.status(201).json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Registration failed' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password, tenantId } = req.body;
    if (!email || !password || !tenantId) return res.status(400).json({ error: 'Missing fields' });

    const token = await loginUser(email, password, tenantId);
    return res.json({ token });
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

export async function getProfile(req: Request, res: Response) {
  try {
    const user = await getUserProfile((req as any).userId);
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get profile' });
  }
}
