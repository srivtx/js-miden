import type { Request, Response } from 'express';
import { evaluateScaling } from '../services/scalingService.js';
import { evaluateWithHysteresis } from '../services/hysteresisService.js';
import type { ScalingRule, Workload } from '../types/index.js';

const rules = new Map<string, ScalingRule>();
const workloads = new Map<string, Workload>();

export function setRule(req: Request, res: Response): void {
  const rule: ScalingRule = req.body;
  rules.set(rule.workloadId, rule);
  res.status(200).json({ status: 'ok' });
}

export function getRule(req: Request, res: Response): void {
  const rule = rules.get(req.params.workloadId);
  if (!rule) {
    res.status(404).json({ error: 'Rule not found' });
    return;
  }
  res.json(rule);
}

export function registerWorkload(req: Request, res: Response): void {
  const wl: Workload = req.body;
  workloads.set(wl.id, wl);
  res.status(200).json({ status: 'ok' });
}

export function getWorkload(req: Request, res: Response): void {
  const wl = workloads.get(req.params.workloadId);
  if (!wl) {
    res.status(404).json({ error: 'Workload not found' });
    return;
  }
  res.json(wl);
}

export function evaluate(req: Request, res: Response): void {
  const { workloadId, mode } = req.body; // mode: 'bug' | 'fixed'
  const wl = workloads.get(workloadId);
  const rule = rules.get(workloadId);
  if (!wl || !rule) {
    res.status(404).json({ error: 'Workload or rule not found' });
    return;
  }
  const decision = mode === 'fixed' ? evaluateWithHysteresis(wl, rule) : evaluateScaling(wl, rule);
  // Update workload replicas if action taken
  if (decision.action !== 'none') {
    wl.currentReplicas = decision.targetReplicas;
    workloads.set(workloadId, wl);
  }
  res.json(decision);
}
