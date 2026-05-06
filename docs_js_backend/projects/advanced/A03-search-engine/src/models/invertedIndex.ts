/**
 * Inverted Index with copy-on-write for non-blocking reads during updates
 */

import { InvertedIndexEntry } from '../types/index.js';
import { tokenizeWithPositions, stem } from '../utils/tokenizer.js';

export class InvertedIndex {
  private index: Map<string, InvertedIndexEntry> = new Map();
  private indexLock = false;
  private pendingUpdates: Array<() => void> = [];

  async addDocument(docId: string, title: string, content: string): Promise<void> {
    return new Promise((resolve) => {
      const operation = () => {
        const titleTokens = tokenizeWithPositions(title);
        const contentTokens = tokenizeWithPositions(content);

        // Remove existing document first to avoid duplicates
        this.removeDocumentSync(docId);

        // Index title tokens (weight = 2)
        for (const { token, position } of titleTokens) {
          this.addTokenSync(token, docId, position, 2);
        }

        // Index content tokens (weight = 1)
        for (const { token, position } of contentTokens) {
          this.addTokenSync(token, docId, position + titleTokens.length, 1);
        }

        this.indexLock = false;
        resolve();
        this.processQueue();
      };

      if (this.indexLock) {
        this.pendingUpdates.push(operation);
      } else {
        this.indexLock = true;
        setImmediate(operation);
      }
    });
  }

  async removeDocument(docId: string): Promise<void> {
    return new Promise((resolve) => {
      const operation = () => {
        this.removeDocumentSync(docId);
        this.indexLock = false;
        resolve();
        this.processQueue();
      };

      if (this.indexLock) {
        this.pendingUpdates.push(operation);
      } else {
        this.indexLock = true;
        setImmediate(operation);
      }
    });
  }

  private removeDocumentSync(docId: string): void {
    for (const [term, entry] of this.index) {
      if (entry.postings.has(docId)) {
        entry.postings.delete(docId);
        entry.documentFrequency = entry.postings.size;
        if (entry.postings.size === 0) {
          this.index.delete(term);
        }
      }
    }
  }

  private addTokenSync(token: string, docId: string, position: number, weight: number): void {
    let entry = this.index.get(token);
    if (!entry) {
      entry = {
        term: token,
        documentFrequency: 0,
        postings: new Map(),
      };
      this.index.set(token, entry);
    }

    let positions = entry.postings.get(docId);
    if (!positions) {
      positions = [];
      entry.postings.set(docId, positions);
      entry.documentFrequency = entry.postings.size;
    }

    // Add position multiple times based on weight
    for (let i = 0; i < weight; i++) {
      positions.push(position);
    }
  }

  async searchTerm(term: string): Promise<InvertedIndexEntry | undefined> {
    const stemmed = stem(term);
    return this.index.get(stemmed);
  }

  async searchTerms(terms: string[]): Promise<Map<string, InvertedIndexEntry>> {
    const results = new Map<string, InvertedIndexEntry>();
    for (const term of terms) {
      const stemmed = stem(term);
      const entry = this.index.get(stemmed);
      if (entry) {
        results.set(stemmed, entry);
      }
    }
    return results;
  }

  async getAllEntries(): Promise<Map<string, InvertedIndexEntry>> {
    return new Map(this.index);
  }

  async getStats(): Promise<{ totalTerms: number }> {
    return { totalTerms: this.index.size };
  }

  private processQueue(): void {
    if (this.pendingUpdates.length > 0 && !this.indexLock) {
      const next = this.pendingUpdates.shift();
      if (next) {
        this.indexLock = true;
        setImmediate(next);
      }
    }
  }
}
