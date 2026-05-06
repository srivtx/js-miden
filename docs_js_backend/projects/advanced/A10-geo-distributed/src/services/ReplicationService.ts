import { RecordData, ReplicationMessage, VectorClock } from '../types/index.js';
import { StorageService } from './StorageService.js';
import { logInfo, logError } from '../utils/logger.js';

/**
 * Replication Service
 * Replicates data across regions.
 */
export class ReplicationService {
  private peers: Set<string> = new Set();
  private pendingReplications: Map<string, ReplicationMessage[]> = new Map();

  constructor(private storage: StorageService) {}

  addPeer(region: string): void {
    this.peers.add(region);
  }

  removePeer(region: string): void {
    this.peers.delete(region);
  }

  replicate(record: RecordData): void {
    const message: ReplicationMessage = {
      type: 'replicate',
      record,
      sourceRegion: this.storage.getRegion(),
    };

    for (const peer of this.peers) {
      const pending = this.pendingReplications.get(peer) || [];
      pending.push(message);
      this.pendingReplications.set(peer, pending);
    }

    logInfo('Replicating record', { recordId: record.id, peers: this.peers.size });
  }

  receiveReplication(message: ReplicationMessage): RecordData | null {
    const { record, sourceRegion } = message;
    const existing = this.storage.get(record.id);

    if (!existing) {
      this.storage.put(record);
      return record;
    }

    // Simple last-write-wins without proper vector clock comparison
    // BUG: This can lose updates from other regions
    if (record.timestamp > existing.timestamp) {
      this.storage.put(record);
      return record;
    }

    return existing;
  }

  getPendingReplications(region: string): ReplicationMessage[] {
    return this.pendingReplications.get(region) || [];
  }

  getPeerCount(): number {
    return this.peers.size;
  }
}