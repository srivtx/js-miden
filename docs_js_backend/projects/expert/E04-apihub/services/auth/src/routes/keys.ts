import { Router, Request, Response } from 'express';
import { generateApiKey, generateId, hashKey } from '@shared/utils/index.js';
import { ApiKey } from '@shared/types/index.js';
import { developers } from './auth.js';

const router = Router();

const apiKeys = new Map<string, ApiKey>();
const keyHashes = new Map<string, string>();

router.post('/create', (req: Request, res: Response) => {
  const { developerId, apiId, tierId } = req.body;
  
  if (!developerId || !apiId || !tierId) {
    res.status(400).json({ error: 'developerId, apiId, tierId required' });
    return;
  }
  
  const developer = developers.get(developerId);
  if (!developer) {
    res.status(404).json({ error: 'Developer not found' });
    return;
  }
  
  const rawKey = generateApiKey();
  const keyHash = hashKey(rawKey);
  
  const key: ApiKey = {
    id: generateId('key'),
    key: rawKey,
    developerId,
    apiId,
    tierId,
    status: 'active',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  };
  
  apiKeys.set(key.id, key);
  keyHashes.set(rawKey, key.id);
  
  res.status(201).json({ key: rawKey, apiKey: key });
});

router.post('/validate', (req: Request, res: Response) => {
  const { key } = req.body;
  
  if (!key) {
    res.status(400).json({ error: 'Key required' });
    return;
  }
  
  const keyId = keyHashes.get(key);
  if (!keyId) {
    res.status(401).json({ error: 'Invalid key' });
    return;
  }
  
  const apiKey = apiKeys.get(keyId);
  if (!apiKey || apiKey.status !== 'active') {
    res.status(401).json({ error: 'Key revoked or expired' });
    return;
  }
  
  if (new Date() > apiKey.expiresAt) {
    apiKey.status = 'expired';
    res.status(401).json({ error: 'Key expired' });
    return;
  }
  
  res.json({
    valid: true,
    apiKeyId: apiKey.id,
    developerId: apiKey.developerId,
    apiId: apiKey.apiId,
    tierId: apiKey.tierId
  });
});

router.post('/revoke', (req: Request, res: Response) => {
  const { keyId } = req.body;
  const apiKey = apiKeys.get(keyId);
  
  if (!apiKey) {
    res.status(404).json({ error: 'Key not found' });
    return;
  }
  
  apiKey.status = 'revoked';
  keyHashes.delete(apiKey.key);
  
  res.json({ revoked: true });
});

router.get('/developer/:developerId', (req: Request, res: Response) => {
  const keys = Array.from(apiKeys.values())
    .filter(k => k.developerId === req.params.developerId);
  res.json({ keys });
});

// BUG EXPOSED: This endpoint does not verify ownership when fetching by key
// It returns the key data for ANY key, not just keys owned by the requesting developer
router.get('/lookup/:key', (req: Request, res: Response) => {
  const keyId = keyHashes.get(req.params.key);
  if (!keyId) {
    res.status(404).json({ error: 'Key not found' });
    return;
  }
  const apiKey = apiKeys.get(keyId);
  res.json({ apiKey });
});

export { apiKeys, keyHashes };
export default router;
