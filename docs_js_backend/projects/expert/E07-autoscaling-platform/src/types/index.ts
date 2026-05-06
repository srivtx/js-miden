export interface Metric {
  workloadId: string;
  name: 'cpu' | 'memory' | 'custom';
  value: number; // percentage or absolute
  timestamp: number;
}

export interface Workload {
  id: string;
  currentReplicas: number;
  minReplicas: number;
  maxReplicas: number;
  cpuRequest: number; // millicores
  memoryRequest: number; // MiB
}

export interface ScalingRule {
  workloadId: string;
  // Bug version uses single threshold
  threshold?: number;
  // Fixed version uses dual thresholds
  scaleUpThreshold?: number;
  scaleDownThreshold?: number;
  scaleUpStep: number;
  scaleDownStep: number;
  cooldownMs: number;
}

export interface Node {
  id: string;
  cpuCapacity: number; // millicores
  memoryCapacity: number; // MiB
  cpuAllocated: number;
  memoryAllocated: number;
  workloads: string[];
}

export type ScalingAction = 'scale_up' | 'scale_down' | 'none';

export interface ScalingDecision {
  workloadId: string;
  action: ScalingAction;
  targetReplicas: number;
  reason: string;
  timestamp: number;
}

export interface ScalingState {
  lastScaleTime: number;
  lastAction: ScalingAction;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface AllocationPlan {
  assignments: Map<string, string[]>; // nodeId -> workloadIds
  unassigned: string[];
  estimatedCost: number;
}
