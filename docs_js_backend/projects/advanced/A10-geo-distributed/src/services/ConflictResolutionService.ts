import { RecordData, VectorClock, ConflictResult } from '../types/index.js';

/**
 * Conflict Resolution Service
 * BUG: No proper conflict resolution. Uses simple last-write-wins which loses data
 * when same record is updated in two regions concurrently.
 */
export class ConflictResolutionService {
  private conflicts: Array<{ recordId: string; timestamp: number; regions: string[] }> = [];

  resolveConflict(local: RecordData, remote: RecordData): ConflictResult {
    const comparison = this.compareVectorClocks(local.vectorClock, remote.vectorClock);

    if (comparison === 'concurrent') {
      // BUG: We have a real conflict but just pick latest timestamp
      // This loses the update from the region with earlier timestamp
      this.conflicts.push({
        recordId: local.id,
        timestamp: Date.now(),
        regions: [local.region, remote.region],
      });

      // Simple last-write-wins (BUG: loses data!)
      const winner = remote.timestamp > local.timestamp ? remote : local;
      const loser = remote.timestamp > local.timestamp ? local : remote;

      return {
        winner,
        loser,
        strategy: 'last-write-wins', // BUG: Should be merge or CRDT
      };
    }

    const winner = comparison === 'remote' ? remote : local;
    const loser = comparison === 'remote' ? local : remote;

    return {
      winner,
      loser,
      strategy: 'vector-clock',
    };
  }

  /**
   * Compare two vector clocks.
   * Returns: 'local' if local is newer, 'remote' if remote is newer, 'concurrent' if conflict.
   */
  compareVectorClocks(local: VectorClock, remote: VectorClock): 'local' | 'remote' | 'concurrent' {
    const allRegions = new Set([...Object.keys(local), ...Object.keys(remote)]);

    let localGreater = false;
    let remoteGreater = false;

    for (const region of allRegions) {
      const localValue = local[region] || 0;
      const remoteValue = remote[region] || 0;

      if (localValue > remoteValue) localGreater = true;
      if (remoteValue > localValue) remoteGreater = true;
    }

    if (localGreater && !remoteGreater) return 'local';
    if (remoteGreater && !localGreater) return 'remote';
    if (!localGreater && !remoteGreater) return 'local'; // Equal
    return 'concurrent';
  }

  getConflicts(): Array<{ recordId: string; timestamp: number; regions: string[] }> {
    return this.conflicts;
  }

  getConflictCount(): number {
    return this.conflicts.length;
  }
}