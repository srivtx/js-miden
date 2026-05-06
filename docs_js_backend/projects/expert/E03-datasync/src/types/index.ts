export interface CRDTDocument {
  id: string;
  type: 'register' | 'map' | 'list';
  data: unknown;
  vectorClock: VectorClock;
  timestamp: number;
  tombstone?: boolean; // BUG: Not used in sync - deleted data comes back
}

export interface VectorClock {
  [peerId: string]: number;
}

export interface SyncMessage {
  type: 'sync' | 'delta' | 'presence' | 'ack';
  peerId: string;
  documents?: CRDTDocument[];
  vectorClock?: VectorClock;
  delta?: DeltaOperation[];
}

export interface DeltaOperation {
  type: 'set' | 'delete' | 'merge';
  documentId: string;
  path: string;
  value?: unknown;
  vectorClock: VectorClock;
}

export interface PresenceInfo {
  peerId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: number;
  cursor?: { documentId: string; position: number };
}

export interface TombstoneEntry {
  documentId: string;
  deletedAt: number;
  vectorClock: VectorClock;
}