import type { Request, Response } from 'express';
import { ingestMetric, getMetrics, getLatestMetric } from '../services/metricsService.js';

export function submitMetric(req: Request, res: Response): void {
  const { workloadId, name, value, timestamp } = req.body;
  if (!workloadId || typeof value !== 'number') {
    res.status(400).json({ error: 'Missing workloadId or value' });
    return;
  }
  ingestMetric({ workloadId, name: name ?? 'cpu', value, timestamp: timestamp ?? Date.now() });
  res.status(202).json({ status: 'accepted' });
}

export function listMetrics(req: Request, res: Response): void {
  const { workloadId } = req.params;
  const windowMs = Number(req.query.windowMs ?? 60000);
  res.json({ workloadId, metrics: getMetrics(workloadId, windowMs) });
}

export function latestMetric(req: Request, res: Response): void {
  const { workloadId } = req.params;
  const { name } = req.query;
  const m = getLatestMetric(workloadId, String(name ?? 'cpu'));
  if (!m) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(m);
}
