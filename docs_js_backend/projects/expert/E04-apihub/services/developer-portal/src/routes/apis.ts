import { Router, Request, Response } from 'express';
import { ApiEndpoint, ApiRoute } from '@shared/types/index.js';
import { generateId } from '@shared/utils/index.js';

const router = Router();

const apis = new Map<string, ApiEndpoint>();

router.post('/register', (req: Request, res: Response) => {
  const { developerId, name, baseUrl, routes } = req.body;
  
  if (!developerId || !name || !baseUrl) {
    res.status(400).json({ error: 'developerId, name, baseUrl required' });
    return;
  }
  
  const api: ApiEndpoint = {
    id: generateId('api'),
    developerId,
    name,
    baseUrl,
    routes: routes || [],
    createdAt: new Date()
  };
  
  apis.set(api.id, api);
  res.status(201).json({ api });
});

router.get('/:apiId', (req: Request, res: Response) => {
  const api = apis.get(req.params.apiId);
  if (!api) {
    res.status(404).json({ error: 'API not found' });
    return;
  }
  res.json({ api });
});

router.get('/developer/:developerId', (req: Request, res: Response) => {
  const developerApis = Array.from(apis.values())
    .filter(a => a.developerId === req.params.developerId);
  res.json({ apis: developerApis });
});

export { apis };
export default router;
