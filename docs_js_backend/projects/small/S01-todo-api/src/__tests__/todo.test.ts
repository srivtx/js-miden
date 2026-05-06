import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';

// Mock Prisma Client
const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockCount = vi.fn();

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    todo: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
      count: mockCount,
    },
  })),
  Status: { pending: 'pending', done: 'done' },
}));

describe('Todo API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /todos', () => {
    it('creates a todo', async () => {
      mockCreate.mockResolvedValue({
        id: '1',
        title: 'Test',
        description: 'Desc',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await request(app)
        .post('/todos')
        .send({ title: 'Test', description: 'Desc' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Test');
    });

    it('rejects empty title', async () => {
      const res = await request(app).post('/todos').send({ title: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('rejects title over 200 chars', async () => {
      const res = await request(app)
        .post('/todos')
        .send({ title: 'a'.repeat(201) });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /todos', () => {
    it('lists todos with pagination', async () => {
      mockFindMany.mockResolvedValue([
        { id: '1', title: 'A', status: 'pending', createdAt: new Date().toISOString() },
      ]);
      mockCount.mockResolvedValue(1);

      const res = await request(app).get('/todos?page=1&limit=5');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
      expect(res.body.pagination.page).toBe(1);
    });

    it('filters by status', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const res = await request(app).get('/todos?status=done');
      expect(res.status).toBe(200);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'done' },
        })
      );
    });

    it('sorts by createdAt desc by default', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await request(app).get('/todos');
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('GET /todos/:id', () => {
    it('returns a todo', async () => {
      mockFindUnique.mockResolvedValue({
        id: '1',
        title: 'Test',
        status: 'pending',
      });

      const res = await request(app).get('/todos/1');
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Test');
    });

    it('returns 404 for missing todo', async () => {
      mockFindUnique.mockResolvedValue(null);
      const res = await request(app).get('/todos/nope');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /todos/:id', () => {
    it('updates a todo', async () => {
      mockFindUnique.mockResolvedValue({
        id: '1',
        title: 'Old',
        status: 'pending',
      });
      mockUpdate.mockResolvedValue({
        id: '1',
        title: 'New',
        status: 'done',
      });

      const res = await request(app)
        .put('/todos/1')
        .send({ title: 'New', status: 'done' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New');
    });

    it('returns 404 if todo does not exist', async () => {
      mockFindUnique.mockResolvedValue(null);

      const res = await request(app)
        .put('/todos/nope')
        .send({ title: 'New' });

      expect(res.status).toBe(404);
    });

    it('BUG: demonstrates lost update race condition', async () => {
      // Simulate two concurrent updates
      mockFindUnique.mockResolvedValue({
        id: '1',
        title: 'Original',
        status: 'pending',
      });

      mockUpdate.mockImplementation((args: any) => ({
        id: args.where.id,
        ...args.data,
      }));

      // Request A: reads Original, then will write title='A'
      const reqA = request(app).put('/todos/1').send({ title: 'A' });
      // Request B: reads Original, then will write title='B'
      const reqB = request(app).put('/todos/1').send({ title: 'B' });

      const [resA, resB] = await Promise.all([reqA, reqB]);

      // Both succeed, but one overwrites the other.
      // In a real DB, the last write wins without knowing about the other.
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      // This test documents the bug: there is no optimistic locking
      // or atomic conditional update, so concurrent writes are unsafe.
    });
  });

  describe('DELETE /todos/:id', () => {
    it('deletes a todo', async () => {
      mockDelete.mockResolvedValue({ id: '1' });
      const res = await request(app).delete('/todos/1');
      expect(res.status).toBe(204);
    });

    it('returns 404 for missing todo', async () => {
      mockDelete.mockRejectedValue({ code: 'P2025' });
      const res = await request(app).delete('/todos/nope');
      expect(res.status).toBe(404);
    });
  });
});
