# v5 — Add Testing (Todo API)

## The Scenario

It's 2am. Your junior refactors the todo update endpoint. "Just moving some logic around," they say. They deploy. Users report that updating a todo sometimes reverts changes. Your junior stares at the code — it looks fine. But they never tested concurrent updates.

## The PAIN: Silent Breakage on Refactor

From v4:

```typescript
router.put('/todos/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = updateSchema.parse(req.body);
    
    const existing = await prisma.todo.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }
    
    const updated = await prisma.todo.update({ where: { id }, data: parsed });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
```

This code has a **race condition** (read-then-write). Two concurrent updates read the same state. The second write overwrites the first. The first user's changes are lost.

Without tests, this bug ships to production.

## The Solution: Vitest + Supertest + Mocks

```typescript
// __tests__/todo.test.ts
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
      mockCreate.mockResolvedValue({ id: '1', title: 'Test', status: 'pending' });
      const res = await request(app).post('/todos').send({ title: 'Test' });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Test');
    });

    it('rejects empty title', async () => {
      const res = await request(app).post('/todos').send({ title: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('rejects title over 200 chars', async () => {
      const res = await request(app).post('/todos').send({ title: 'a'.repeat(201) });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /todos', () => {
    it('lists todos with pagination', async () => {
      mockFindMany.mockResolvedValue([{ id: '1', title: 'A', status: 'pending' }]);
      mockCount.mockResolvedValue(1);
      
      const res = await request(app).get('/todos?page=1&limit=5');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.totalPages).toBe(1);
    });

    it('filters by status', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      
      await request(app).get('/todos?status=done');
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'done' } })
      );
    });
  });

  describe('PUT /todos/:id', () => {
    it('updates a todo', async () => {
      mockFindUnique.mockResolvedValue({ id: '1', title: 'Old' });
      mockUpdate.mockResolvedValue({ id: '1', title: 'New' });
      
      const res = await request(app).put('/todos/1').send({ title: 'New' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New');
    });

    it('BUG: demonstrates lost update race condition', async () => {
      mockFindUnique.mockResolvedValue({ id: '1', title: 'Original', status: 'pending' });
      mockUpdate.mockImplementation((args: any) => ({ id: args.where.id, ...args.data }));
      
      // Simulate two concurrent updates
      const reqA = request(app).put('/todos/1').send({ title: 'A' });
      const reqB = request(app).put('/todos/1').send({ title: 'B' });
      
      const [resA, resB] = await Promise.all([reqA, reqB]);
      
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      // Both succeed, but one overwrites the other. No optimistic locking.
    });
  });

  describe('DELETE /todos/:id', () => {
    it('returns 404 for missing todo', async () => {
      mockDelete.mockRejectedValue({ code: 'P2025' });
      const res = await request(app).delete('/todos/nope');
      expect(res.status).toBe(404);
    });
  });
});
```

### What testing catches:

| Scenario | Without tests | With tests |
|----------|--------------|------------|
| Refactor breaks validation | Deploy, users find out | **CI fails** before merge |
| Pagination off-by-one | Users see wrong pages | **Test expects** `totalPages: 1` |
| Race condition | Data loss in production | **Test documents** the bug |
| Prisma error handling | 500s leak to client | **Test verifies** 404 for missing records |
| Schema changes | Runtime crashes | **Mock mismatch** alerts you |

## The PAIN of Database Testing

```typescript
// DON'T hit real database in unit tests
// - Slow (100ms+ per test)
// - Flaky (race conditions, state leakage)
// - Requires Docker/CI setup

// DO mock the database layer
// - Fast (<10ms per test)
// - Deterministic
// - Tests YOUR code, not Prisma's
```

Mocking Prisma means:
- Your tests run in milliseconds
- No database setup required
- You control every response (error cases, empty results, edge cases)

## Testing Evolution in Todo API

| Version | Testing | Confidence |
|---------|---------|------------|
| v1 (JS) | Manual curl | Zero |
| v2 (TS) | Still manual | Zero |
| v3 (Validation) | Still manual | Zero |
| v4 (Logging) | Still manual | Zero |
| v5 (Vitest) | Automated, mocked, fast | High |

## The Realization

> Junior: "I wrote a test for the race condition. It passes, but the comment says 'BUG'. Now every developer who sees this test knows about the lost update problem."
> 
> You: "Tests are documentation that executes. A passing test with a 'BUG' comment is better than a wiki page nobody reads. It proves the behavior exists and documents why it's wrong."

## The Next PAIN

Tests protect your code. But your code runs in a module system from 2009. CommonJS (`require`) is legacy. ESM (`import`) is the 2025 standard. Mixing them causes subtle bugs.

## Next: v6 — Switch to ESM
