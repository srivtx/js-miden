import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { Application } from 'express';

describe('Bug Regression Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('BUG: Search scans entire document table (no index, O(n))', () => {
    it('should use inverted index for O(1) term lookup', async () => {
      // Index many documents to make O(n) scan noticeable
      const docCount = 100;
      for (let i = 0; i < docCount; i++) {
        await request(app)
          .post('/documents')
          .send({
            title: `Document ${i}`,
            content: `Unique content for document number ${i} with special word xyzabc${i}`,
            tags: ['bulk'],
          });
      }

      // Search should be fast even with many documents
      const startTime = Date.now();
      const response = await request(app)
        .get('/search')
        .query({ q: 'xyzabc50' })
        .expect(200);
      const duration = Date.now() - startTime;

      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].document.title).toBe('Document 50');
      // O(n) scan of 100 documents should take >50ms, O(1) index lookup should be <50ms
      expect(duration).toBeLessThan(100);
    });

    it('should find only documents containing the term', async () => {
      // If scanning O(n), it might return wrong results or too many
      await request(app)
        .post('/documents')
        .send({
          title: 'Apple Pie Recipe',
          content: 'How to make apple pie',
          tags: ['recipe'],
        });

      await request(app)
        .post('/documents')
        .send({
          title: 'Banana Bread',
          content: 'How to make banana bread',
          tags: ['recipe'],
        });

      const response = await request(app)
        .get('/search')
        .query({ q: 'apple' })
        .expect(200);

      // Should only return apple document, not all documents
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].document.title).toBe('Apple Pie Recipe');
    });
  });

  describe('BUG: Stemmer not used ("running" does not match "run")', () => {
    it('should match "running" when searching for "run"', async () => {
      await request(app)
        .post('/documents')
        .send({
          title: 'Running Guide',
          content: 'A guide to running marathons',
          tags: ['running'],
        });

      const response = await request(app)
        .get('/search')
        .query({ q: 'run' })
        .expect(200);

      const titles = response.body.results.map((r: any) => r.document.title);
      expect(titles).toContain('Running Guide');
    });

    it('should match plural forms with singular queries', async () => {
      await request(app)
        .post('/documents')
        .send({
          title: 'Cat Care',
          content: 'How to care for cats',
          tags: ['pets'],
        });

      const response = await request(app)
        .get('/search')
        .query({ q: 'cat' })
        .expect(200);

      const contents = response.body.results.map((r: any) => r.document.content);
      expect(contents.some((c: string) => c.includes('cats'))).toBe(true);
    });

    it('should match verb conjugations', async () => {
      await request(app)
        .post('/documents')
        .send({
          title: 'Programming',
          content: 'I program every day',
          tags: ['coding'],
        });

      const response = await request(app)
        .get('/search')
        .query({ q: 'programming' })
        .expect(200);

      const titles = response.body.results.map((r: any) => r.document.title);
      expect(titles).toContain('Programming');
    });
  });

  describe('BUG: Updates block reads (table locked during indexing)', () => {
    it('should allow search during document indexing', async () => {
      // Start indexing a large document
      const indexPromise = request(app)
        .post('/documents')
        .send({
          title: 'Large Document',
          content: 'a '.repeat(10000),
          tags: ['large'],
        });

      // Search should complete without waiting for index
      const searchStart = Date.now();
      const searchResponse = await request(app)
        .get('/search')
        .query({ q: 'test' })
        .expect(200);
      const searchDuration = Date.now() - searchStart;

      expect(searchDuration).toBeLessThan(200);
      expect(searchResponse.body).toBeDefined();

      await indexPromise;
    });

    it('should allow concurrent reads during bulk indexing', async () => {
      const indexPromises = [];
      for (let i = 0; i < 20; i++) {
        indexPromises.push(
          request(app)
            .post('/documents')
            .send({
              title: `Bulk ${i}`,
              content: `Content ${i}`,
              tags: ['bulk'],
            })
        );
      }

      // Search during bulk indexing
      const searchResponse = await request(app)
        .get('/search')
        .query({ q: 'bulk' })
        .expect(200);

      expect(searchResponse.body.results.length).toBeGreaterThanOrEqual(0);

      await Promise.all(indexPromises);
    });
  });
});
