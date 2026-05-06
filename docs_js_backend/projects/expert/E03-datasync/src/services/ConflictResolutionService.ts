import { CRDTDocument, VectorClock } from '../types/index.js';

/**
 * Conflict Resolution Service
 * Uses CRDT principles for conflict-free merging.
 */
export class ConflictResolutionService {
  private mergeCount = 0;

  resolve(local: CRDTDocument, remote: CRDTDocument): CRDTDocument {
    if (local.id !== remote.id) {
      throw new Error('Cannot resolve documents with different IDs');
    }

    const comparison = this.compareVectorClocks(local.vectorClock, remote.vectorClock);

    if (comparison === 'local') {
      return local;
    } else if (comparison === 'remote') {
      return remote;
    } else {
      // Concurrent - merge using LWW-element-set or similar CRDT strategy
      this.mergeCount++;
      return this.mergeDocuments(local, remote);
    }
  }

  private mergeDocuments(local: CRDTDocument, remote: CRDTDocument): CRDTDocument {
    // For registers, use timestamp-based LWW as merge strategy
    // For maps/lists, would use deeper merge logic
    const winner = local.timestamp > remote.timestamp ? local : remote;
    const mergedClock = this.mergeVectorClocks(local.vectorClock, remote.vectorClock);

    return {
      ...winner,
      vectorClock: mergedClock,
      timestamp: Math.max(local.timestamp, remote.timestamp),
    };
  }

  compareVectorClocks(local: VectorClock, remote: VectorClock): 'local' | 'remote' | 'concurrent' {
    const allPeers = new Set([...Object.keys(local), ...Object.keys(remote)]);

    let localGreater = false;
    let remoteGreater = false;

    for (const peer of allPeers) {
      const localValue = local[peer] || 0;
      const remoteValue = remote[peer] || 0;

      if (localValue > remoteValue) localGreater = true;
      if (remoteValue > localValue) remoteGreater = true;
    }

    if (localGreater && !remoteGreater) return 'local';
    if (remoteGreater && !localGreater) return 'remote';
    if (!localGreater && !remoteGreater) return 'local';
    return 'concurrent';
  }

  private mergeVectorClocks(local: VectorClock, remote: VectorClock): VectorClock {
    const merged: VectorClock = {};
    const allPeers = new Set([...Object.keys(local), ...Object.keys(remote)]);

    for (const peer of allPeers) {
      merged[peer] = Math.max(local[peer] || 0, remote[peer] || 0);
    }

    return merged;
  }

  getMergeCount(): number {
    return this.mergeCount;
  }
}