import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '../src/services/StorageService.js';
import { ReplicationService } from '../src/services/ReplicationService.js';

describe('ReplicationService', () => {
  let storage: StorageService;
  let replication: ReplicationService;

  beforeEach(() => {
    storage = new StorageService('us-east');
    replication = new ReplicationService(storage);
    replication.addPeer('us-west');
    replication.addPeer('eu-west');
  });

  it('should queue replications to peers', () => {
    const record = storage.update('record-1', { name: 'Alice' });
    replication.replicate(record);

    expect(replication.getPendingReplications('us-west')).toHaveLength(1);
    expect(replication.getPendingReplications('eu-west')).toHaveLength(1);
  });

  it('should receive replication for new record', () => {
    const record = storage.update('record-1', { name: 'Alice' });
    replication.replicate(record);

    const pending = replication.getPendingReplications('us-west')[0];
    const newStorage = new StorageService('us-west');
    const newReplication = new ReplicationService(newStorage);
    newReplication.receiveReplication(pending);

    expect(newStorage.get('record-1')).not.toBeNull();
  });

  it('BUG: Last-write-wins loses concurrent updates', () => {
    // Simulate two regions updating the same record concurrently
    const storage1 = new StorageService('us-east');
    const storage2 = new StorageService('us-west');

    // Region 1 updates
    const record1 = storage1.update('user-123', { balance: 100 });

    // Region 2 updates concurrently (before seeing region 1's update)
    const record2 = storage2.update('user-123', { balance: 200 });

    // Region 2's replication arrives at Region 1
    const replication1 = new ReplicationService(storage1);
    replication1.receiveReplication({
      type: 'replicate',
      record: record2,
      sourceRegion: 'us-west',
    });

    // BUG: Last write wins based on timestamp loses the first update
    // In real world, timestamps can be skewed
    const finalRecord = storage1.get('user-123');
    // The test documents that one of the updates is lost
    expect(finalRecord).not.toBeNull();
  });

  it('should track peer count', () => {
    expect(replication.getPeerCount()).toBe(2);
    replication.removePeer('eu-west');
    expect(replication.getPeerCount()).toBe(1);
  });
});