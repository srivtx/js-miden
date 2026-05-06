import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from '../src/services/StorageService.js';
import { SyncService } from '../src/services/SyncService.js';
import { ConflictResolutionService } from '../src/services/ConflictResolutionService.js';

describe('StorageService', () => {
  let storage: StorageService;

  beforeEach(() => {
    storage = new StorageService();
  });

  it('should store and retrieve documents', () => {
    storage.storeDocument({
      id: 'doc-1',
      type: 'register',
      data: { title: 'Hello' },
      vectorClock: { peer1: 1 },
      timestamp: Date.now(),
    });

    const doc = storage.getDocument('doc-1');
    expect(doc).not.toBeNull();
    expect(doc?.data).toEqual({ title: 'Hello' });
  });

  it('should delete documents', () => {
    storage.storeDocument({
      id: 'doc-1',
      type: 'register',
      data: { title: 'Hello' },
      vectorClock: { peer1: 1 },
      timestamp: Date.now(),
    });

    storage.deleteDocument('doc-1');
    expect(storage.getDocument('doc-1')).toBeNull();
    expect(storage.getTombstoneCount()).toBe(1);
  });

  it('BUG: Deleted documents are not filtered from getAllDocuments (when tombstones not used)', () => {
    storage.storeDocument({
      id: 'doc-1',
      type: 'register',
      data: { title: 'Hello' },
      vectorClock: { peer1: 1 },
      timestamp: Date.now(),
    });

    storage.deleteDocument('doc-1');
    const all = storage.getAllDocuments();

    // BUG: getAllDocuments doesn't check tombstones before returning
    // It returns all docs, but since we deleted it, it's not in documents map
    // The real bug is when syncing - tombstones aren't sent to peers
    expect(all).toHaveLength(0); // This passes because we deleted from documents map
    expect(storage.isDeleted('doc-1')).toBe(true);
  });

  it('should track global vector clock', () => {
    storage.storeDocument({
      id: 'doc-1',
      type: 'register',
      data: { title: 'Hello' },
      vectorClock: { peer1: 1, peer2: 3 },
      timestamp: Date.now(),
    });

    storage.storeDocument({
      id: 'doc-2',
      type: 'register',
      data: { title: 'World' },
      vectorClock: { peer1: 2, peer2: 2 },
      timestamp: Date.now(),
    });

    const clock = storage.getGlobalVectorClock();
    expect(clock).toEqual({ peer1: 2, peer2: 3 });
  });
});

describe('SyncService', () => {
  let storage: StorageService;
  let conflictService: ConflictResolutionService;
  let syncService: SyncService;

  beforeEach(() => {
    storage = new StorageService();
    conflictService = new ConflictResolutionService();
    syncService = new SyncService(storage, conflictService);
  });

  it('should connect and disconnect peers', () => {
    const ws = { send: vi.fn() } as any;
    syncService.connectPeer('peer-1', ws);
    expect(syncService.getConnectedPeers()).toContain('peer-1');

    syncService.disconnectPeer('peer-1');
    expect(syncService.getConnectedPeers()).not.toContain('peer-1');
  });

  it('BUG: Deleted documents come back during sync', () => {
    // Setup: Peer 1 creates a document
    storage.storeDocument({
      id: 'doc-1',
      type: 'register',
      data: { title: 'Original' },
      vectorClock: { peer1: 1 },
      timestamp: Date.now(),
    });

    // Peer 1 deletes the document
    storage.deleteDocument('doc-1');
    expect(storage.getDocument('doc-1')).toBeNull();

    // Simulate peer 2 connecting and requesting sync
    // In the bug, the sync service doesn't send tombstones
    // So if peer 2 has an old version, it will recreate the document
    const ws2 = { send: vi.fn() } as any;
    syncService.connectPeer('peer-2', ws2);

    syncService.handleMessage('peer-2', {
      type: 'sync',
      peerId: 'peer-2',
    });

    // The sync response should include tombstones, but doesn't (BUG)
    const response = JSON.parse(ws2.send.mock.calls[0][0]);
    expect(response.documents).toHaveLength(0); // No documents (good)
    expect(response.tombstones).toBeUndefined(); // BUG: No tombstones sent!
  });

  it('should handle delta updates', () => {
    const ws1 = { send: vi.fn() } as any;
    const ws2 = { send: vi.fn() } as any;

    syncService.connectPeer('peer-1', ws1);
    syncService.connectPeer('peer-2', ws2);

    syncService.handleMessage('peer-1', {
      type: 'delta',
      peerId: 'peer-1',
      delta: [{
        type: 'set',
        documentId: 'doc-1',
        path: '/',
        value: { title: 'Updated' },
        vectorClock: { peer1: 1 },
      }],
    });

    // Peer 2 should receive the delta
    expect(ws2.send).toHaveBeenCalled();
  });
});