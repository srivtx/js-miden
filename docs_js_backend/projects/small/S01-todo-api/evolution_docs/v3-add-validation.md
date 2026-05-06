# v3 — Add Validation (Todo API)

## The Scenario

It's 2am. Your junior added TypeScript. "No more typos!" they celebrate. Then a user sends `POST /todos` with `{ title: 12345 }` and the database stores it. TypeScript didn't help — the runtime data was wrong.

## The PAIN: TypeScript Doesn't Validate Runtime Data

From v2:

```typescript
app.post('/todos', (req: Request, res: Response) => {
  const input: CreateTodoInput = req.body; // Type assertion = TRUST
  // User sends: { title: 12345, status: 'hacked' }
  // TypeScript believes it's valid. The database receives garbage.
});
```

TypeScript is a compile-time guard. At runtime, `req.body` is whatever the client sent. A type assertion (`as CreateTodoInput`) is a lie we tell the compiler.

### Real bugs from production:

```json
// User sends:
{ "title": "", "status": "completed" }
// Empty title stored. Status enum violated.

{ "title": "a".repeat(10000) }
// Database column size exceeded. Truncated or error.

{ "title": "Buy milk", "extraField": "DROP TABLE" }
// Innocuous here, but pattern-matched by SQL later = injection
```

## The Solution: Zod Schema Validation

```typescript
// routes.ts
import { z } from 'zod';

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
```

```typescript
app.post('/todos', async (req, res, next) => {
  try {
    const parsed = createSchema.parse(req.body);
    // ^ Zod validates AND transforms. parsed is guaranteed to match the schema.
    const todo = await prisma.todo.create({ data: parsed });
    res.status(201).json(todo);
  } catch (err) {
    next(err); // Goes to error handler
  }
});
```

### What Zod catches:

| Input | TypeScript alone | Zod validation |
|-------|---------------|----------------|
| `{ title: 12345 }` | ❌ Accepts via assertion | **Error**: Expected string, received number |
| `{ title: "" }` | ❌ Accepts empty string | **Error**: String must contain at least 1 character(s) |
| `{ status: "hacked" }` | ❌ Accepts any string | **Error**: Invalid enum value |
| `{ title: "a".repeat(10000) }` | ❌ Accepts | **Error**: String must contain at most 200 character(s) |
| `{ extraField: "x" }` | ❌ Accepts (structural typing) | **Strips** (with `.strict()` would error) |
| `page=abc` | ❌ Accepts as string | **Error**: Expected number, received nan |

## The PAIN of Naive Validation

```typescript
// The "I'll write it myself" approach (DON'T)
function validateTodo(body: any) {
  if (!body.title) throw new Error('Title required');
  if (typeof body.title !== 'string') throw new Error('Title must be string');
  if (body.title.length > 200) throw new Error('Title too long');
  // ... 50 more lines for every field
  // Forgot to check description length? Oops.
  // Forgot to validate status enum? Oops.
}
```

Hand-rolled validation is:
- **Verbose**: 50 lines vs 5 lines of Zod
- **Inconsistent**: One endpoint checks lengths, another doesn't
- **Untyped**: The "validated" output is still `any`

## The Zod Advantage: Types from Schemas

```typescript
// Derive TypeScript types FROM the schema (single source of truth)
type CreateTodoInput = z.infer<typeof createSchema>;
// Equivalent to: { title: string; description?: string; status?: 'pending' | 'done' }
```

Now your TypeScript types and runtime validators are **the same thing**. Change the schema? Both update automatically.

## Validation Evolution in the Todo API

| Version | Validation | What breaks |
|---------|-----------|-------------|
| v1 (JS) | None | Everything |
| v2 (TS) | Type assertions | Runtime garbage |
| v3 (Zod) | Schema parsing | Nothing (caught at boundary) |

## The Realization

> Junior: "Zod rejected a request with `title: 12345`. The error message even said 'Expected string, received number'."
> 
> You: "That's the difference. TypeScript tells *you* about bugs. Zod tells *users* about their mistakes. Both are necessary."

## The Next PAIN

Validation catches user bugs, but what about **your** bugs? What happens when Prisma throws because the database is down? What happens when an unhandled promise rejection crashes the process?

## Next: v4 — Add Logging
