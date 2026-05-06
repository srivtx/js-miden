import { Router } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

// In production this MUST be loaded from a secure environment variable.
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

router.post('/login', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const token = jwt.sign({ sub: userId }, SECRET, {
    expiresIn: '1h',
    algorithm: 'HS256',
  });

  res.json({ token });
});

router.get('/protected', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // -------------------------------------------------------------------------
    // BUG: ignoreExpiration: true disables expiry checking.
    //
    // This means a token that expired days ago is still accepted.
    // An attacker with a stolen token retains access forever.
    // -------------------------------------------------------------------------
    const decoded = jwt.verify(token, SECRET, {
      algorithms: ['HS256'],
      ignoreExpiration: true,
    });

    res.json({ message: 'Access granted', user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
