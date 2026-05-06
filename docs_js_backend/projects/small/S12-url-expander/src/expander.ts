import { Router } from 'express';
import { expandUrl } from './follower.js';
import { isValidUrl } from './validator.js';

const router = Router();

router.post('/', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid or blocked URL' });
  }

  try {
    const result = await expandUrl(url);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
