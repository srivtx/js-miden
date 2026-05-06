/**
 * In-memory document store with non-blocking read operations
 */

import { Document } from '../types/index.js';

export class DocumentStore {
  private documents: Map<string, Document> = new Map();
  private writeQueue: Array<() => void> = [];
  private isWriting = false;

  async get(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getAll(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }

  async getByIds(ids: string[]): Promise<Document[]> {
    return ids
      .map((id) => this.documents.get(id))
      .filter((doc): doc is Document => doc !== undefined);
  }

  async save(doc: Document): Promise<void> {
    return new Promise((resolve) => {
      const operation = () => {
        this.documents.set(doc.id, doc);
        this.isWriting = false;
        resolve();
        this.processQueue();
      };

      if (this.isWriting) {
        this.writeQueue.push(operation);
      } else {
        this.isWriting = true;
        // Use setImmediate to yield control and not block reads
        setImmediate(operation);
      }
    });
  }

  async delete(id: string): Promise<boolean> {
    return new Promise((resolve) => {
      const operation = () => {
        const existed = this.documents.delete(id);
        this.isWriting = false;
        resolve(existed);
        this.processQueue();
      };

      if (this.isWriting) {
        this.writeQueue.push(operation);
      } else {
        this.isWriting = true;
        setImmediate(operation);
      }
    });
  }

  async count(): Promise<number> {
    return this.documents.size;
  }

  private processQueue(): void {
    if (this.writeQueue.length > 0 && !this.isWriting) {
      const next = this.writeQueue.shift();
      if (next) {
        this.isWriting = true;
        setImmediate(next);
      }
    }
  }
}
