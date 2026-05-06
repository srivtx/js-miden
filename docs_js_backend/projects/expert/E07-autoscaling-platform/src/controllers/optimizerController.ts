import type { Request, Response } from 'express';
import { firstFitDecreasing } from '../services/costOptimizer.js';
import type { Node, Workload } from '../types/index.js';

export function optimize(req: Request, res: Response): void {
  const { workloads, nodes }: { workloads: Workload[]; nodes: Node[] } = req.body;
  if (!Array.isArray(workloads) || !Array.isArray(nodes)) {
    res.status(400).json({ error: 'workloads and nodes arrays required' });
    return;
  }
  const plan = firstFitDecreasing(workloads, nodes);
  res.json({
    assignments: Object.fromEntries(plan.assignments),
    unassigned: plan.unassigned,
    estimatedCost: plan.estimatedCost,
  });
}
