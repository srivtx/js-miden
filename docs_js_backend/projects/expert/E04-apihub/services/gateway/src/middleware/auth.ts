import { Router, Request, Response, NextFunction } from 'express';
import { ServiceClient } from '../clients/service-client.js';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const authClient = new ServiceClient(AUTH_URL);

export async function validateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    res.status(401).json({ error: 'API key required' });
    return;
  }
  
  try {
    const result = await authClient.post('/keys/validate', { key: apiKey }) as any;
    
    if (!result.valid) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
    
    // BUG: We attach the validated key info to the request
    // BUT we don't verify that the key's developerId matches the API's developerId
    // This allows cross-developer API access!
    (req as any).apiKeyContext = {
      apiKeyId: result.apiKeyId,
      developerId: result.developerId,
      apiId: result.apiId,
      tierId: result.tierId
    };
    
    next();
  } catch (error) {
    res.status(503).json({ error: 'Auth service unavailable' });
  }
}

const router = Router();
export default router;
