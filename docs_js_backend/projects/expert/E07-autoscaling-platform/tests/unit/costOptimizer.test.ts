import { describe, it, expect } from 'vitest';
import { firstFitDecreasing } from '../../src/services/costOptimizer.js';
import type { Node, Workload } from '../../src/types/index.js';

describe('costOptimizer', () => {
  it('packs workloads onto nodes', () => {
    const workloads: Workload[] = [
      { id: 'a', currentReplicas: 1, minReplicas: 1, maxReplicas: 5, cpuRequest: 500, memoryRequest: 512 },
      { id: 'b', currentReplicas: 1, minReplicas: 1, maxReplicas: 5, cpuRequest: 300, memoryRequest: 256 },
      { id: 'c', currentReplicas: 1, minReplicas: 1, maxReplicas: 5, cpuRequest: 200, memoryRequest: 128 },
    ];
    const nodes: Node[] = [
      { id: 'n1', cpuCapacity: 1000, memoryCapacity: 1024, cpuAllocated: 0, memoryAllocated: 0, workloads: [] },
    ];
    const plan = firstFitDecreasing(workloads, nodes);
    expect(plan.unassigned).toHaveLength(0);
    expect(plan.assignments.get('n1')).toContain('a');
    expect(plan.assignments.get('n1')).toContain('b');
    expect(plan.assignments.get('n1')).toContain('c');
  });

  it('reports unassigned when capacity exceeded', () => {
    const workloads: Workload[] = [
      { id: 'a', currentReplicas: 1, minReplicas: 1, maxReplicas: 5, cpuRequest: 600, memoryRequest: 512 },
      { id: 'b', currentReplicas: 1, minReplicas: 1, maxReplicas: 5, cpuRequest: 600, memoryRequest: 512 },
    ];
    const nodes: Node[] = [
      { id: 'n1', cpuCapacity: 1000, memoryCapacity: 1024, cpuAllocated: 0, memoryAllocated: 0, workloads: [] },
    ];
    const plan = firstFitDecreasing(workloads, nodes);
    expect(plan.unassigned.length).toBeGreaterThan(0);
  });
});
