import { Router } from 'express';
import { PrismaClient, Status } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(['pending', 'done']).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['pending', 'done']).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['pending', 'done']).optional(),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

// POST /todos - Create
router.post('/', async (req, res, next) => {
  try {
    const parsed = createSchema.parse(req.body);
    const todo = await prisma.todo.create({ data: parsed });
    res.status(201).json(todo);
  } catch (err) {
    next(err);
  }
});

// GET /todos - List with pagination, filter, sort
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, status, sort } = listQuerySchema.parse(req.query);
    const where = status ? { status: status as Status } : {};

    const [todos, total] = await Promise.all([
      prisma.todo.findMany({
        where,
        orderBy: { createdAt: sort },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.todo.count({ where }),
    ]);

    res.json({
      data: todos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /todos/:id - Get one
router.get('/:id', async (req, res, next) => {
  try {
    const todo = await prisma.todo.findUnique({ where: { id: req.params.id } });
    if (!todo) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }
    res.json(todo);
  } catch (err) {
    next(err);
  }
});

// PUT /todos/:id - Update (BUGGY - race condition)
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = updateSchema.parse(req.body);

    // BUG: Read-then-write pattern creates a race condition.
    // Two concurrent requests can read the same original state,
    // then the second write overwrites the first without knowing
    // the first ever happened (lost update).
    const existing = await prisma.todo.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }

    const updated = await prisma.todo.update({
      where: { id },
      data: parsed,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /todos/:id - Delete
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.todo.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Todo not found' });
      return;
    }
    next(err);
  }
});

// Error handler for Zod validation
router.use((err: any, _req: any, res: any, next: any) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
    });
    return;
  }
  next(err);
});

export default router;
