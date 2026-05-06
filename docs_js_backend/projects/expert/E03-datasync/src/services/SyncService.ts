import { CRDTDocument, SyncMessage, VectorClock, PresenceInfo } from '../types/index.js';
import { StorageService } from './StorageService.js';
import { ConflictResolutionService } from './ConflictResolutionService.js';
import { logInfo, logError } from '../utils/logger.js';

/**
 * Sync Service
 * Handles real-time synchronization of CRDT documents.
 * BUG: No tombstones propagated during sync - deleted documents reappear.
 */
export class SyncService {
  private peers: Map<string, WebSocket> = new Map();
  private documentVersions: Map<string, VectorClock> = new Map();

  constructor(
    private storage: StorageService,
    private conflictService: ConflictResolutionService
  ) {}

  connectPeer(peerId: string, ws: WebSocket): void {
    this.peers.set(peerId, ws);
    logInfo('Peer connected', { peerId });

    // Send initial sync
    this.sendFullSync(peerId);
  }

  disconnectPeer(peerId: string): void {
    this.peers.delete(peerId);
    logInfo('Peer disconnected', { peerId });
  }

  handleMessage(peerId: string, message: SyncMessage): void {
    switch (message.type) {
      case 'sync':
        this.handleSyncRequest(peerId, message);
        break;
      case 'delta':
        this.handleDelta(peerId, message);
        break;
      case 'ack':
        this.handleAck(peerId, message);
        break;
    }
  }

  private handleSyncRequest(peerId: string, message: SyncMessage): void {
    // Get all documents from storage
    const documents = this.storage.getAllDocuments();

    // BUG: We send all documents including ones that were deleted locally
    // but may have been recreated by other peers because we don't track tombstones
    const response: SyncMessage = {
      type: 'sync',
      peerId: 'server',
      documents,
      vectorClock: this.storage.getGlobalVectorClock(),
    };

    this.sendToPeer(peerId, response);
  }

  private handleDelta(peerId: string, message: SyncMessage): void {
    if (!message.delta) return;

    for (const op of message.delta) {
      const existing = this.storage.getDocument(op.documentId);

      if (op.type === 'delete') {
        // BUG: We delete locally but don't propagate tombstone to other peers
        // So when they sync, they might recreate the document
        this.storage.deleteDocument(op.documentId);
        // BUG: Should create and propagate tombstone here
      } else if (op.type === 'set') {
        const newDoc: CRDTDocument = {
          id: op.documentId,
          type: 'register',
          data: op.value,
          vectorClock: op.vectorClock,
          timestamp: Date.now(),
        };

        if (existing) {
          const resolved = this.conflictService.resolve(existing, newDoc);
          this.storage.storeDocument(resolved);
        } else {
          this.storage.storeDocument(newDoc);
        }
      }
    }

    // Broadcast delta to other peers
    this.broadcastDelta(peerId, message.delta);
  }

  private broadcastDelta(excludePeerId: string, delta: any[]): void {
    const message: SyncMessage = {
      type: 'delta',
      peerId: 'server',
      delta,
    };

    for (const [peerId, ws] of this.peers) {
      if (peerId === excludePeerId) continue;
      ws.send(JSON.stringify(message));
    }
  }

  private sendFullSync(peerId: string): void {
    const documents = this.storage.getAllDocuments();
    const message: SyncMessage = {
      type: 'sync',
      peerId: 'server',
      documents,
      vectorClock: this.storage.getGlobalVectorClock(),
    };

    this.sendToPeer(peerId, message);
  }

  private sendToPeer(peerId: string, message: SyncMessage): void {
    const ws = this.peers.get(peerId);
    if (ws) {
      ws.send(JSON.stringify(message));
    }
  }

  private handleAck(peerId: string, message: SyncMessage): void {
    // Acknowledgment handling for reliability
    logInfo('Received ack', { peerId });
  }

  getConnectedPeers(): string[] {
    return Array.from(this.peers.keys());
  }
}