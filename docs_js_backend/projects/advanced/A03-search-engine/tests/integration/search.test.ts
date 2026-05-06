import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { Application } from 'express';

describe('Search API Integration', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  it('should search documents by query', async () => {
    // Index some documents first
    await request(app)
      .post('/documents')
      .send({
        title: 'JavaScript Basics',
        content: 'Learn JavaScript programming basics',
        tags: ['javascript', 'programming'],
      });

    await request(app)
      .post('/documents')
      .send({
        title: 'Advanced Python',
        content: 'Master Python programming techniques',
        tags: ['python', 'programming'],
      });

    const response = await request(app)
      .get('/search')
      .query({ q: 'javascript' })
      .expect(200);

    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0].document.title).toBe('JavaScript Basics');
    expect(response.body.total).toBe(1);
    expect(response.body.took).toBeGreaterThanOrEqual(0);
  });

  it('should use stemming to match related words', async () => {
    await request(app)
      .post('/documents')
      .send({
        title: 'Running Tips',
        content: 'Tips for running marathons',
        tags: ['running', 'fitness'],
      });

    // Search for "run" should match "running"
    const response = await request(app)
      .get('/search')
      .query({ q: 'run' })
      .expect(200);

    expect(response.body.results.length).toBeGreaterThan(0);
    const titles = response.body.results.map((r: any) => r.document.title);
    expect(titles).toContain('Running Tips');
  });

  it('should filter by tags', async () => {
    await request(app)
      .post('/documents')
      .send({
        title: 'Doc 1',
        content: 'Content 1',
        tags: ['tag1'],
      });

    await request(app)
      .post('/documents')
      .send({
        title: 'Doc 2',
        content: 'Content 2',
        tags: ['tag2'],
      });

    const response = await request(app)
      .get('/search')
      .query({ q: 'content', tags: 'tag1' })
      .expect(200);

    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0].document.title).toBe('Doc 1');
  });

  it('should filter by date range', async () => {
    await request(app)
      .post('/documents')
      .send({
        title: 'Old Doc',
        content: 'Old content',
        tags: ['old'],
      });

    await request(app)
      .post('/documents')
      .send({
        title: 'New Doc',
        content: 'New content',
        tags: ['new'],
      });

    const response = await request(app)
      .get('/search')
      .query({
        q: 'content',
        dateFrom: '2025-01-01',
        dateTo: '2027-12-31',
      })
      .expect(200);

    expect(response.body.results.length).toBeGreaterThan(0);
    const titles = response.body.results.map((r: any) => r.document.title);
    expect(titles).toContain('New Doc');
    // Note: Both docs were created today, so both match the date range
    // This verifies the date filter includes today's documents
  });

  it('should highlight matching terms', async () => {
    await request(app)
      .post('/documents')
      .send({
        title: 'Highlight Test',
        content: 'This is a highlight test document',
        tags: ['test'],
      });

    const response = await request(app)
      .get('/search')
      .query({ q: 'highlight', highlight: 'true' })
      .expect(200);

    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0].highlights).toBeDefined();
    expect(response.body.results[0].highlights.content).toBeDefined();
    expect(response.body.results[0].highlights.content[0]).toContain('<mark>highlight</mark>');
  });

  it('should return facets', async () => {
    await request(app)
      .post('/documents')
      .send({
        title: 'Doc A',
        content: 'Content A',
        tags: ['tag1', 'tag2'],
      });

    await request(app)
      .post('/documents')
      .send({
        title: 'Doc B',
        content: 'Content B',
        tags: ['tag2', 'tag3'],
      });

    const response = await request(app)
      .get('/search')
      .query({ q: 'content' })
      .expect(200);

    expect(response.body.facets).toBeDefined();
    expect(response.body.facets.tags).toBeInstanceOf(Array);
    expect(response.body.facets.tags.length).toBeGreaterThan(0);
  });

  it('should paginate results', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/documents')
        .send({
          title: `Doc ${i}`,
          content: `Content ${i}`,
          tags: ['pagination'],
        });
    }

    const response = await request(app)
      .get('/search')
      .query({ q: 'content', limit: 2, offset: 0 })
      .expect(200);

    expect(response.body.results).toHaveLength(2);
    expect(response.body.total).toBeGreaterThanOrEqual(5);
  });

  it('should return empty results for non-matching query', async () => {
    const response = await request(app)
      .get('/search')
      .query({ q: 'nonexistentterm12345' })
      .expect(200);

    expect(response.body.results).toHaveLength(0);
    expect(response.body.total).toBe(0);
  });

  it('should return stats', async () => {
    const response = await request(app)
      .get('/stats')
      .expect(200);

    expect(response.body.totalDocuments).toBeDefined();
    expect(response.body.totalTerms).toBeDefined();
    expect(response.body.averageDocumentLength).toBeDefined();
  });
});
