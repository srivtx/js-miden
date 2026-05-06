/**
 * Index Service - handles document indexing with non-blocking updates
 */

import { Document, IndexDocumentRequest } from '../types/index.js';
import { DocumentStore } from '../models/documentStore.js';
import { InvertedIndex } from '../models/invertedIndex.js';
import { randomUUID } from 'crypto';

export class IndexService {
  constructor(
    private documentStore: DocumentStore,
    private invertedIndex: InvertedIndex
  ) {}

  async indexDocument(request: IndexDocumentRequest): Promise<Document> {
    const now = new Date();
    const doc: Document = {
      id: randomUUID(),
      title: request.title,
      content: request.content,
      tags: request.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    // Store document first (non-blocking)
    await this.documentStore.save(doc);

    // Update inverted index (non-blocking)
    await this.invertedIndex.addDocument(doc.id, doc.title, doc.content);

    return doc;
  }

  async updateDocument(id: string, request: Partial<IndexDocumentRequest>): Promise<Document | null> {
    const existing = await this.documentStore.get(id);
    if (!existing) return null;

    const updated: Document = {
      ...existing,
      title: request.title ?? existing.title,
      content: request.content ?? existing.content,
      tags: request.tags ?? existing.tags,
      updatedAt: new Date(),
    };

    await this.documentStore.save(updated);
    await this.invertedIndex.addDocument(updated.id, updated.title, updated.content);

    return updated;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const existed = await this.documentStore.delete(id);
    if (existed) {
      await this.invertedIndex.removeDocument(id);
    }
    return existed;
  }

  async getDocument(id: string): Promise<Document | null> {
    return (await this.documentStore.get(id)) || null;
  }

  async listDocuments(limit: number = 10, offset: number = 0): Promise<{ documents: Document[]; total: number }> {
    const all = await this.documentStore.getAll();
    return {
      documents: all.slice(offset, offset + limit),
      total: all.length,
    };
  }
}
