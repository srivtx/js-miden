import { describe, it, expect, beforeEach } from 'vitest';
import { InvertedIndex } from '../../src/models/invertedIndex.js';

describe('InvertedIndex', () => {
  let index: InvertedIndex;

  beforeEach(() => {
    index = new InvertedIndex();
  });

  it('should index a document and retrieve by term', async () => {
    await index.addDocument('doc1', 'Hello World', 'This is a test');

    const entry = await index.searchTerm('hello');
    expect(entry).toBeDefined();
    expect(entry?.documentFrequency).toBe(1);
    expect(entry?.postings.has('doc1')).toBe(true);
  });

  it('should find stemmed terms', async () => {
    await index.addDocument('doc1', 'Running fast', 'I love running');

    const entry = await index.searchTerm('run');
    expect(entry).toBeDefined();
    expect(entry?.postings.has('doc1')).toBe(true);
  });

  it('should remove document from index', async () => {
    await index.addDocument('doc1', 'Hello', 'World');
    await index.removeDocument('doc1');

    const entry = await index.searchTerm('hello');
    expect(entry).toBeUndefined();
  });

  it('should handle multiple documents', async () => {
    await index.addDocument('doc1', 'Hello World', 'Test');
    await index.addDocument('doc2', 'Hello Universe', 'Test');

    const entry = await index.searchTerm('hello');
    expect(entry).toBeDefined();
    expect(entry?.documentFrequency).toBe(2);
  });

  it('should not block reads during indexing', async () => {
    await index.addDocument('doc1', 'Hello', 'World');

    // Start indexing a new document
    const indexPromise = index.addDocument('doc2', 'Hello Again', 'More content');

    // Search should not be blocked
    const searchStart = Date.now();
    const result = await index.searchTerm('hello');
    const searchDuration = Date.now() - searchStart;

    expect(result).toBeDefined();
    expect(searchDuration).toBeLessThan(100);

    await indexPromise;
  });
});
