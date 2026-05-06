export type Operation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface ChangeEvent {
  lsn: number; // Log Sequence Number
  table: string;
  operation: Operation;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  timestamp: number;
}

export interface WalPosition {
  lsn: number;
  committed: boolean;
}

export interface ConsumerOffset {
  consumerId: string;
  lastLsn: number;
}
