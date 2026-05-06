import { RecordData, ReplicationMessage, VectorClock } from '../types/index.js';

/**
 * Storage Service
 * Local per-region storage with replication support.
 */
export class StorageService {
  private store: Map<string, RecordData> = new Map();
  private region: string;

  constructor(region: string) {
    this.region = region;
  }

  get(id: string): RecordData | null {
    return this.store.get(id) || null;
  }

  put(record: RecordData): void {
    this.store.set(record.id, record);
  }

  update(id: string, value: unknown): RecordData {
    const existing = this.store.get(id);
    const now = Date.now();

    const vectorClock: VectorClock = existing
      ? { ...existing.vectorClock, [this.region]: (existing.vectorClock[this.region] || 0) + 1 }
      : { [this.region]: 1 };

    const record: RecordData = {
      id,
      value,
      timestamp: now,
      region: this.region,
      vectorClock,
      version: existing ? existing.version + 1 : 1,
    };

    this.store.set(id, record);
    return record;
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  getAll(): RecordData[] {
    return Array.from(this.store.values());
  }

  getRegion(): string {
    return this.region;
  }
}