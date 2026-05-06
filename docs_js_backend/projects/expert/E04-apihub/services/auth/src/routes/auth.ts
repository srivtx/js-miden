import { Router, Request, Response } from 'express';
import { generateId, hashKey } from '@shared/utils/index.js';
import { Developer } from '@shared/types/index.js';

const router = Router();

const developers = new Map<string, Developer>();

router.post('/register', (req: Request, res: Response) => {
  const { email, name } = req.body;
  
  if (!email || !name) {
    res.status(400).json({ error: 'Email and name required' });
    return;
  }
  
  const id = generateId('dev');
  const developer: Developer = {
    id,
    email,
    name,
    createdAt: new Date()
  };
  
  developers.set(id, developer);
  
  res.status(201).json({ developer });
});

router.get('/developer/:id', (req: Request, res: Response) => {
  const developer = developers.get(req.params.id);
  if (!developer) {
    res.status(404).json({ error: 'Developer not found' });
    return;
  }
  res.json({ developer });
});

export { developers };
export default router;
