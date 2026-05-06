# v3 — Add Validation

Your task tracker has TypeScript types, but they vanish at runtime. A user sends `{ priority: 'banana', dueDate: 'tomorrow' }` and TypeScript can't stop it. MongoDB stores garbage. The frontend breaks.

## Pain #1: Garbage Data in Database

```typescript
// No runtime validation — TypeScript types are compile-time only
app.post('/tasks', async (req, res) => {
  const task = await Task.create(req.body); // Stores ANYTHING
});
```

A script sends `{ status: 'hacked', priority: 'critical', organizationId: null }`. MongoDB stores it. The task list API returns it. The frontend crashes because `status: 'hacked'` isn't in the enum.

## Pain #2: Cross-Tenant Leaks via Missing Fields

```typescript
app.post('/tasks', async (req, res) => {
  const task = await Task.create({
    ...req.body,
    reporterId: user.userId,
    // organizationId is missing!
  });
});
```

Without validation requiring `organizationId`, tasks are created without a tenant scope. They become globally visible. Any user can read them.

## Pain #3: Injection via Unvalidated Strings

A user sends `{ title: { "$gt": "" } }`. MongoDB interprets it as a query operator. Without validation, this can be used in NoSQL injection attacks.

## The Fix: Zod + Request Validation

```typescript
// src/middleware/validation.ts
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']).default('backlog'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  projectId: z.string().min(1),
  assigneeId: z.string().optional(),
  dueDate: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
});

export const UpdateTaskSchema = CreateTaskSchema.partial();

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(i => ({ path: i.path, message: i.message })),
      });
    }
    req.body = result.data;
    next();
  };
}
```

```typescript
// src/task/routes/index.ts
import { validateBody, CreateTaskSchema, UpdateTaskSchema } from '../middleware/validation.js';
import { authenticate } from '../../auth/middleware/auth.js';

router.post('/tasks', authenticate, validateBody(CreateTaskSchema), taskController.createTask);
router.put('/tasks/:id', authenticate, validateBody(UpdateTaskSchema), taskController.updateTask);
```

Now:
- `title: null` → 400 "Expected string, received null"
- `priority: 'banana'` → 400 "Invalid enum value"
- `dueDate: 'tomorrow'` → 400 "Invalid datetime"
- Missing `projectId` → 400 "Required"

## The Multi-Tenant Validation Layer

```typescript
// src/task/middleware/auth.ts
export function requireOrganizationAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user?.organizationId) {
    return res.status(403).json({ error: 'No organization assigned' });
  }
  
  // Inject organizationId into body for create operations
  if (req.method === 'POST') {
    req.body.organizationId = user.organizationId;
  }
  
  next();
}
```

Every task is now scoped to an organization at creation. No more orphan tasks.

## What Changed

| Before | After |
|--------|-------|
| Any JSON accepted | Strict schema enforcement |
| NoSQL injection possible | Only expected fields pass through |
| Missing tenant IDs | Organization injected automatically |
| Frontend gets garbage data | API rejects bad data at the edge |
| "It works on my machine" bugs | Validation is identical in dev, staging, prod |

## Validation as Security

Validation is not just UX. It is a security boundary. By rejecting unexpected fields, you prevent:
- NoSQL injection via object payloads
- Mass assignment attacks (user sets `role: 'admin'`)
- Data corruption that breaks downstream consumers

## Next Pain

Validation catches bad input, but when things go wrong deep in the stack, you have no idea why. A controller throws and you get a generic 500. You need logging.
