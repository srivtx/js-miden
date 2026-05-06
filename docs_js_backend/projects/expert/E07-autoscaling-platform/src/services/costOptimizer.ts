import type { AllocationPlan, Node, Workload } from '../types/index.js';

export function firstFitDecreasing(workloads: Workload[], nodes: Node[]): AllocationPlan {
  // Sort workloads by descending cpuRequest (FFD)
  const sorted = [...workloads].sort((a, b) => b.cpuRequest - a.cpuRequest);
  const assignments = new Map<string, string[]>();
  const unassigned: string[] = [];

  for (const node of nodes) {
    assignments.set(node.id, [...node.workloads]);
  }

  for (const wl of sorted) {
    let placed = false;
    for (const node of nodes) {
      const remainingCpu = node.cpuCapacity - node.cpuAllocated;
      const remainingMem = node.memoryCapacity - node.memoryAllocated;
      if (wl.cpuRequest <= remainingCpu && wl.memoryRequest <= remainingMem) {
        node.cpuAllocated += wl.cpuRequest;
        node.memoryAllocated += wl.memoryRequest;
        node.workloads.push(wl.id);
        assignments.get(node.id)!.push(wl.id);
        placed = true;
        break;
      }
    }
    if (!placed) unassigned.push(wl.id);
  }

  // Cost model: $ per node active
  const activeNodes = nodes.filter(n => n.workloads.length > 0).length;
  const estimatedCost = activeNodes * 100; // $100 per node stub

  return { assignments, unassigned, estimatedCost };
}
