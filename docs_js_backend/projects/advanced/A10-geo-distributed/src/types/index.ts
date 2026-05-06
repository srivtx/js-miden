export interface RecordData {
  id: string;
  value: unknown;
  timestamp: number;
  region: string;
  vectorClock: VectorClock;
  version: number;
}

export interface VectorClock {
  [region: string]: number;
}

export interface UpdateRequest {
  id: string;
  value: unknown;
}

export interface ReplicationMessage {
  type: 'replicate' | 'sync' | 'conflict';
  record: RecordData;
  sourceRegion: string;
}

export interface RouteRequest {
  userId: string;
  region: string;
  latency: number;
}

export interface ConflictResult {
  winner: RecordData;
  loser: RecordData;
  strategy: string;
}