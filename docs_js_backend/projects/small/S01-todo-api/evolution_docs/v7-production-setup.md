# v7 — Production Setup (Todo API)

## The Scenario

It's 2am. Your junior deploys the todo API to production. "It works!" they say. Then the container restarts. All todos vanish. "But it was working..." they whimper. You check: in-memory array. No database. No persistence. Every deploy is a data apocalypse.

## The PAIN: Development Data Is Not Production Data

From v6:

```typescript
const todos: Todo[] = []; // In-memory. Ephemeral. Dead on restart.
```

Local development can survive data loss. Production cannot. Users create todos. They expect them to exist tomorrow.

### The evolution of persistence in this project:

| Version | Storage | Data survives restart? |
|---------|---------|----------------------|
| v1 | In-memory array | ❌ No |
| v2 | File-based JSON | ⚠️ Corrupts on concurrent writes |
| v3 | SQLite | ⚠️ No connection pooling, file locks |
| v4 | PostgreSQL + Prisma | ✓ Production-ready |

## The Solution: PostgreSQL + Prisma + Production Patterns

### 1. Database Schema (Prisma)

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Todo {
  id          String   @id @default(cuid())
  title       String
  description String?
  status      Status   @default(pending)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@index([status])
  @@index([createdAt])
  @@map("todos")
}

enum Status {
  pending
  done
}
```

Why Prisma?
- **Type-safe queries**: `prisma.todo.create()` returns a typed object
- **Migrations**: Schema changes are versioned and reversible
- **Connection pooling**: Reuses connections instead of creating per-request

### 2. Environment Configuration

```bash
# .env.example
DATABASE_URL="postgresql://user:pass@localhost:5432/todos?schema=public"
PORT=3000
LOG_LEVEL=info
```

### 3. Production Routes (connecting to src/)

```typescript
// src/routes.ts (actual production code)
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
```

### 4. Pagination Implementation

```typescript
// Why pagination matters:
// Without it: GET /todos returns 100,000 rows
// - 10MB JSON response
// - Blocks event loop for seconds
// - Mobile clients crash parsing it

// With it: GET /todos?page=1&limit=20
// - 20 rows, <1KB response
// - Instant
// - Scales to millions of rows
```

### 5. The Race Condition Bug (Documented)

```typescript
// PUT /todos/:id - Update
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = updateSchema.parse(req.body);

    // BUG: Read-then-write pattern creates a race condition.
    // Two concurrent requests read the same original state,
    // then the second write overwrites the first.
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
```

This bug is **intentionally left** in the codebase as a teaching tool. The test documents it. The comment explains it. Fix it with optimistic locking (`version` field) or atomic updates.

### 6. Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  }
}
```

## Production Checklist

| Concern | v1 | v7 (Production) |
|---------|-----|----------------|
| Persistence | In-memory array | PostgreSQL with migrations |
| Validation | None | Zod schemas |
| Types | None | TypeScript + Prisma generated types |
| Testing | None | Vitest + mocked Prisma |
| Logging | console.log | Structured Pino (add in real prod) |
| Pagination | All rows | Configurable with metadata |
| Module system | CommonJS | ESM |
| Data loss | Every restart | Survives forever |

## The Realization

> Junior: "I connected to PostgreSQL and suddenly todos survive restarts. Then I realized: every layer we added — types, validation, tests, ESM — was necessary to get here without breaking everything."
> 
> You: "Production isn't one big change. It's seven small evolutions, each fixing the pain of the last. The array taught us persistence matters. File storage taught us concurrency matters. SQLite taught us types matter. PostgreSQL + Prisma is where all those lessons converge."

## Files in this project

```
S01-todo-api/
├── src/
│   ├── index.ts          # Entry point (ESM)
│   ├── app.ts            # Express app setup
│   ├── routes.ts         # CRUD + pagination + validation
│   └── __tests__/
│       └── todo.test.ts  # Vitest tests with mocked Prisma
├── prisma/
│   └── schema.prisma     # Database schema
├── .env.example
├── package.json          # ESM, scripts, dependencies
└── tsconfig.json         # NodeNext module resolution
```

## What You Learned

1. **Persistence evolution**: array → file → SQLite → PostgreSQL. Each step taught a lesson.
2. **Validation is non-negotiable**: Zod at the boundary prevents garbage from reaching the database.
3. **Tests document bugs**: The race condition test proves the bug exists and prevents accidental "fixes" that don't address root cause.
4. **ESM is the future**: `"type": "module"` isn't a preference, it's a requirement for modern packages.
5. **Pagination is performance**: Without it, your API dies at scale.
