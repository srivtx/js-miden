import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { Application } from 'express';

describe('Document API Integration', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  it('should index a new document', async () => {
    const response = await request(app)
      .post('/documents')
      .send({
        title: 'Test Document',
        content: 'This is a test document',
        tags: ['test', 'document'],
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.title).toBe('Test Document');
    expect(response.body.tags).toEqual(['test', 'document']);
  });

  it('should reject invalid document', async () => {
    await request(app)
      .post('/documents')
      .send({
        title: '',
        content: 'Content',
      })
      .expect(400);
  });

  it('should retrieve a document by id', async () => {
    const createResponse = await request(app)
      .post('/documents')
      .send({
        title: 'Retrieve Test',
        content: 'Content to retrieve',
        tags: ['test'],
      });

    const id = createResponse.body.id;

    const response = await request(app)
      .get(`/documents/${id}`)
      .expect(200);

    expect(response.body.title).toBe('Retrieve Test');
  });

  it('should return 404 for non-existent document', async () => {
    await request(app)
      .get('/documents/nonexistent-id')
      .expect(404);
  });

  it('should update a document', async () => {
    const createResponse = await request(app)
      .post('/documents')
      .send({
        title: 'Update Test',
        content: 'Original content',
        tags: ['test'],
      });

    const id = createResponse.body.id;

    const response = await request(app)
      .patch(`/documents/${id}`)
      .send({
        title: 'Updated Title',
      })
      .expect(200);

    expect(response.body.title).toBe('Updated Title');
    expect(response.body.content).toBe('Original content');
  });

  it('should delete a document', async () => {
    const createResponse = await request(app)
      .post('/documents')
      .send({
        title: 'Delete Test',
        content: 'Content to delete',
        tags: ['test'],
      });

    const id = createResponse.body.id;

    await request(app)
      .delete(`/documents/${id}`)
      .expect(204);

    await request(app)
      .get(`/documents/${id}`)
      .expect(404);
  });

  it('should list documents with pagination', async () => {
    const response = await request(app)
      .get('/documents')
      .query({ limit: 5, offset: 0 })
      .expect(200);

    expect(response.body.documents).toBeInstanceOf(Array);
    expect(response.body.total).toBeDefined();
  });

  it('should handle concurrent indexing without blocking', async () => {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        request(app)
          .post('/documents')
          .send({
            title: `Concurrent Doc ${i}`,
            content: `Content ${i}`,
            tags: ['concurrent'],
          })
      );
    }

    const responses = await Promise.all(promises);
    expect(responses.every((r) => r.status === 201)).toBe(true);
  });
});
