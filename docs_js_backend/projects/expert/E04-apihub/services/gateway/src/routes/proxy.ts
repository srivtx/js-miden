import { Router, Request, Response } from 'express';
import { ServiceClient } from '../clients/service-client.js';
import { validateApiKey } from '../middleware/auth.js';
import { checkRateLimit } from '../middleware/ratelimit.js';

const router = Router();

const USAGE_URL = process.env.USAGE_SERVICE_URL || 'http://localhost:3002';
const PORTAL_URL = process.env.PORTAL_SERVICE_URL || 'http://localhost:3005';
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3004';

const usageClient = new ServiceClient(USAGE_URL);
const portalClient = new ServiceClient(PORTAL_URL);
const analyticsClient = new ServiceClient(ANALYTICS_URL);

// In-memory target API registry for demo
const targetApis = new Map<string, { baseUrl: string; developerId: string }>();

router.post('/register-target', async (req: Request, res: Response) => {
  const { apiId, baseUrl, developerId } = req.body;
  targetApis.set(apiId, { baseUrl, developerId });
  res.json({ registered: true });
});

router.all('/:apiId/*', validateApiKey, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const apiKeyContext = (req as any).apiKeyContext;
  const apiId = req.params.apiId;
  const endpoint = req.params[0] || '/';
  
  // BUG: The gateway fetches the target API info but NEVER checks
  // if apiKeyContext.developerId === targetApi.developerId
  // This means ANY valid API key can access ANY registered API!
  const targetApi = targetApis.get(apiId);
  if (!targetApi) {
    res.status(404).json({ error: 'API not found' });
    return;
  }
  
  // Check rate limit
  try {
    const rateLimitResult = await checkRateLimit(apiKeyContext.apiKeyId, 10);
    if (!rateLimitResult.allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000)
      });
      return;
    }
    
    // Proxy the request (simulated)
    const responseTime = Date.now() - startTime;
    
    // Record usage
    await usageClient.post('/track', {
      apiKeyId: apiKeyContext.apiKeyId,
      apiId,
      developerId: targetApi.developerId, // BUG: We use target's developer, not key's developer!
      endpoint,
      method: req.method,
      statusCode: 200,
      responseTimeMs: responseTime
    });
    
    // Send to analytics
    await analyticsClient.post('/event', {
      apiId,
      endpoint,
      method: req.method,
      responseTimeMs: responseTime,
      statusCode: 200
    });
    
    res.setHeader('X-RateLimit-Remaining', String(rateLimitResult.remaining));
    res.setHeader('X-RateLimit-Reset', rateLimitResult.resetAt.toISOString());
    
    res.json({
      proxied: true,
      apiId,
      endpoint,
      method: req.method,
      responseTimeMs: responseTime,
      // BUG: We expose that we used the target developer's ID for billing
      billedToDeveloperId: targetApi.developerId
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await usageClient.post('/track', {
      apiKeyId: apiKeyContext.apiKeyId,
      apiId,
      developerId: targetApi.developerId,
      endpoint,
      method: req.method,
      statusCode: 500,
      responseTimeMs: responseTime
    });
    
    res.status(500).json({ error: 'Proxy failed', message: (error as Error).message });
  }
});

export { targetApis };
export default router;
