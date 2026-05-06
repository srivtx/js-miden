# S01: Todo API (Full CRUD)

A full CRUD Todo API backed by PostgreSQL via Prisma.

## Endpoints

- `POST /todos` - Create a todo
- `GET /todos` - List todos with pagination, filtering, and sorting
- `GET /todos/:id` - Get a single todo
- `PUT /todos/:id` - Update a todo
- `DELETE /todos/:id` - Delete a todo

## Fields

| Field       | Type        | Constraints                |
|-------------|-------------|----------------------------|
| id          | CUID        | Primary key                |
| title       | String      | Required, max 200 chars    |
| description | String?     | Optional                   |
| status      | Enum        | `pending` or `done`        |
| createdAt   | DateTime    | Auto-set on create         |
| updatedAt   | DateTime    | Auto-updated on mutation   |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# 3. Run migrations
npx prisma migrate dev --name init

# 4. Start dev server
npm run dev

# 5. Run tests
npm test
```

## Phase 1: Basic Implementation

- Prisma schema with `Todo` model and indexes on `status` and `createdAt`.
- Zod validation for `title` (required, 1-200 chars) and `status`.
- Pagination via `page`/`limit` offset pattern.
- Filtering by `status` and sorting by `createdAt` (asc/desc).

## Phase 2-3: Design Thinking

### 1. Database Schema & Indexes

**Indexes added:**
- `@@index([status])` - speeds up filtering by status.
- `@@index([createdAt])` - speeds up sorting and time-range queries.

**Trade-offs:**
- More indexes = faster reads, slower writes, more disk usage.
- For a small app, these two indexes cover the main query patterns.

### 2. Pagination: Offset vs. Cursor

**Decision needed:** Which pagination strategy?

- **Offset (current):** `skip: (page - 1) * limit`. Simple, works with any sort. Problem: performance degrades on deep pages (high `skip` values). Also susceptible to duplicate/missed items if data changes between pages.
- **Cursor-based:** `where: { createdAt: { lt: lastCursor } }`. Consistent results even if data changes. Problem: only works well with stable sort columns. Harder to jump to arbitrary pages.

**Conclusion:** Offset pagination is acceptable for small to medium datasets (< 100k rows). For large-scale APIs, cursor-based is preferred.

### 3. Validation Strategy

**Decision needed:** How to validate inputs?

- **Manual checks:** Fastest, but repetitive and error-prone.
- **Zod (current):** Declarative schemas, excellent TypeScript integration, clear error messages. Prevents malformed data from reaching the DB.
- **Prisma built-in:** Good for DB-level constraints (e.g., `@db.VarChar(200)`), but doesn't handle API-level validation well.

**Conclusion:** Zod at the API boundary + Prisma constraints at the DB layer is the best defense.

### 4. Soft Delete vs. Hard Delete

**Decision needed:** Should deletes be recoverable?

- **Hard delete (current):** `prisma.todo.delete()`. Simple, but data is gone forever.
- **Soft delete:** Add `deletedAt` column. Filter it out in queries. Allows undo and audit trails.

**Conclusion:** For a production todo app, soft delete is usually worth the small complexity cost.

## Known Bug

The `PUT /todos/:id` endpoint has a **race condition (lost update)**.

### The Problem

```typescript
// Current (BUGGY) code:
const existing = await prisma.todo.findUnique({ where: { id } });
if (!existing) { return 404; }
const updated = await prisma.todo.update({ where: { id }, data: parsed });
```

This is a **read-then-write** pattern:
1. Request A reads the todo (title = "Original").
2. Request B reads the same todo (title = "Original").
3. Request A writes title = "A".
4. Request B writes title = "B", completely overwriting A's change without ever knowing A existed.

**Result:** Update A is silently lost.

### How to Fix

Use an **atomic update** or **optimistic locking**:

**Option 1: Atomic update directly (simplest)**
Skip the read check and let Prisma's `update` throw if the ID doesn't exist:

```typescript
try {
  const updated = await prisma.todo.update({
    where: { id },
    data: parsed,
  });
  res.json(updated);
} catch (err: any) {
  if (err.code === 'P2025') {
    res.status(404).json({ error: 'Todo not found' });
    return;
  }
  throw err;
}
```

This still allows last-write-wins, but removes the extra round-trip and the 404 check race.

**Option 2: Optimistic locking (prevents lost updates)**
Add a `version` field to the schema:

```prisma
model Todo {
  // ... other fields
  version Int @default(0)
}
```

```typescript
const { id } = req.params;
const { version, ...data } = req.body;

try {
  const updated = await prisma.todo.update({
    where: { id, version },
    data: { ...data, version: { increment: 1 } },
  });
  res.json(updated);
} catch (err: any) {
  if (err.code === 'P2025') {
    // Either todo not found OR version mismatch
    res.status(409).json({ error: 'Todo was modified by another request' });
    return;
  }
  throw err;
}
```

**Option 3: Conditional update with updatedAt**
Similar to Option 2 but uses `updatedAt` as an implicit version:

```typescript
const { id } = req.params;
const { lastUpdatedAt, ...data } = req.body;

const updated = await prisma.todo.updateMany({
  where: { id, updatedAt: new Date(lastUpdatedAt) },
  data,
});

if (updated.count === 0) {
  res.status(409).json({ error: 'Todo was modified by another request' });
  return;
}
res.json(await prisma.todo.findUnique({ where: { id } }));
```

**Recommendation:** For most CRUD APIs, atomic direct updates (Option 1) are sufficient. If preventing overwrites is a business requirement, use optimistic locking (Option 2).
