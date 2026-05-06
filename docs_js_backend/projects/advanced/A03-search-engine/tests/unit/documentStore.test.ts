import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentStore } from '../../src/models/documentStore.js';
import { Document } from '../../src/types/index.js';

describe('DocumentStore', () => {
  let store: DocumentStore;

  beforeEach(() => {
    store = new DocumentStore();
  });

  it('should save and retrieve a document', async () => {
    const doc: Document = {
      id: '1',
      title: 'Test',
      content: 'Content',
      tags: ['test'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await store.save(doc);
    const retrieved = await store.get('1');
    expect(retrieved).toEqual(doc);
  });

  it('should return undefined for non-existent document', async () => {
    const result = await store.get('nonexistent');
    expect(result).toBeUndefined();
  });

  it('should delete a document', async () => {
    const doc: Document = {
      id: '1',
      title: 'Test',
      content: 'Content',
      tags: ['test'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await store.save(doc);
    const deleted = await store.delete('1');
    expect(deleted).toBe(true);
    expect(await store.get('1')).toBeUndefined();
  });

  it('should return all documents', async () => {
    const doc1: Document = {
      id: '1',
      title: 'Test 1',
      content: 'Content 1',
      tags: ['test'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const doc2: Document = {
      id: '2',
      title: 'Test 2',
      content: 'Content 2',
      tags: ['test'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await store.save(doc1);
    await store.save(doc2);
    const all = await store.getAll();
    expect(all).toHaveLength(2);
  });

  it('should not block reads during writes', async () => {
    const doc: Document = {
      id: '1',
      title: 'Test',
      content: 'Content',
      tags: ['test'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await store.save(doc);

    // Start a write operation
    const writePromise = store.save({ ...doc, title: 'Updated' });

    // Read should not be blocked
    const readStart = Date.now();
    const readResult = await store.get('1');
    const readDuration = Date.now() - readStart;

    expect(readResult).toBeDefined();
    expect(readDuration).toBeLessThan(100); // Should be immediate

    await writePromise;
  });
});
