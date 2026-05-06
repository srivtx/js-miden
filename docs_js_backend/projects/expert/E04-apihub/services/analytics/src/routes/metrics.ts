import { Router, Request, Response } from 'express';
import { AnalyticsMetric } from '@shared/types/index.js';

const router = Router();

const metrics: AnalyticsMetric[] = [];

router.post('/event', (req: Request, res: Response) => {
  const { apiId, endpoint, method, responseTimeMs, statusCode } = req.body;
  
  const metric: AnalyticsMetric = {
    timestamp: new Date(),
    apiId,
    endpoint,
    requests: 1,
    avgResponseTime: responseTimeMs,
    errorRate: statusCode >= 400 ? 1 : 0
  };
  
  metrics.push(metric);
  res.status(201).json({ recorded: true });
});

router.get('/dashboard/:apiId', (req: Request, res: Response) => {
  const { apiId } = req.params;
  const hours = parseInt(req.query.hours as string) || 24;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const apiMetrics = metrics.filter(m => m.apiId === apiId && m.timestamp >= cutoff);
  
  const totalRequests = apiMetrics.reduce((sum, m) => sum + m.requests, 0);
  const avgResponseTime = apiMetrics.length > 0
    ? apiMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / apiMetrics.length
    : 0;
  const errorCount = apiMetrics.filter(m => m.errorRate > 0).length;
  const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;
  
  const endpoints = new Map<string, { requests: number; avgResponseTime: number }>();
  for (const m of apiMetrics) {
    const existing = endpoints.get(m.endpoint);
    if (existing) {
      existing.requests += m.requests;
      existing.avgResponseTime = (existing.avgResponseTime + m.avgResponseTime) / 2;
    } else {
      endpoints.set(m.endpoint, { requests: m.requests, avgResponseTime: m.avgResponseTime });
    }
  }
  
  res.json({
    apiId,
    period: `${hours}h`,
    totalRequests,
    avgResponseTime,
    errorRate,
    endpoints: Array.from(endpoints.entries()).map(([path, stats]) => ({ path, ...stats }))
  });
});

export { metrics };
export default router;
