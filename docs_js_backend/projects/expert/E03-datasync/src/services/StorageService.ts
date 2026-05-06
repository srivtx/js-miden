import { CRDTDocument, VectorClock, TombstoneEntry } from '../types/index.js';

/**
 * Storage Service
 * BUG: No tombstones stored. When a document is deleted, it's just removed.
 * Other peers syncing will recreate it from their old state.
 */
export class StorageService {
  private documents: Map<string, CRDTDocument> = new Map();
  // BUG: tombstones array exists but is never used in sync logic
  private tombstones: Map<string, TombstoneEntry> = new Map();
  private globalClock: VectorClock = {};

  storeDocument(doc: CRDTDocument): void {
    this.documents.set(doc.id, doc);
    this.updateGlobalClock(doc.vectorClock);
  }

  getDocument(id: string): CRDTDocument | null {
    // BUG: We don't check tombstones before returning!
    // Should return null if document is tombstoned
    return this.documents.get(id) || null;
  }

  deleteDocument(id: string): void {
    const doc = this.documents.get(id);
    if (doc) {
      // BUG: We store tombstone but never propagate it in sync
      this.tombstones.set(id, {
        documentId: id,
        deletedAt: Date.now(),
        vectorClock: { ...doc.vectorClock },
      });
      this.documents.delete(id);
    }
  }

  getAllDocuments(): CRDTDocument[] {
    // BUG: Returns all documents, doesn't filter out tombstoned ones
    // or tell peers about deletions
    return Array.from(this.documents.values());
  }

  getTombstones(): TombstoneEntry[] {
    return Array.from(this.tombstones.values());
  }

  isDeleted(id: string): boolean {
    return this.tombstones.has(id);
  }

  getGlobalVectorClock(): VectorClock {
    return { ...this.globalClock };
  }

  private updateGlobalClock(clock: VectorClock): void {
    for (const [peer, count] of Object.entries(clock)) {
      this.globalClock[peer] = Math.max(this.globalClock[peer] || 0, count);
    }
  }

  getDocumentCount(): number {
    return this.documents.size;
  }

  getTombstoneCount(): number {
    return this.tombstones.size;
  }
}