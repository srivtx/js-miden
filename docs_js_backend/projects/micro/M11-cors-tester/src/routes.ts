import { Router } from 'express';

export const publicRouter = Router();

publicRouter.get('/', (_req, res) => {
  res.json({ message: 'Public data', timestamp: Date.now() });
});

export const privateRouter = Router();

privateRouter.get('/', (req, res) => {
  // Simulate auth check
  const auth = req.headers.authorization;
  if (!auth) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }
  res.json({ message: 'Private data', user: 'admin' });
});
