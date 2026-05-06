# v2 — Adding TypeScript

The task tracker works, but every refactor is terrifying. You change a field name and pray nothing breaks. Runtime errors like `Cannot read property 'name' of undefined` hit production weekly.

## Pain: Runtime Type Errors

```js
// A task from v1
app.post('/tasks', (req, res) => {
  const task = { id: idCounter++, ...req.body };
  // req.body might be: { tite: 'Typo', priority: 999 }
  // No error until the frontend breaks
});
```

A developer renames `assigneeId` to `assignedTo` in the frontend. The backend still stores `assigneeId`. Tasks show as unassigned. No error is thrown anywhere.

A new engineer adds `dueDate: req.body.dueDate` and passes a string. MongoDB stores it. The sorting logic expects a Date. `task.dueDate.getTime()` throws on a string.

## Solution: TypeScript + Explicit Interfaces

```typescript
// src/types/index.ts
export interface Task {
  _id: string;
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  projectId: string;
  assigneeId?: string;
  reporterId: string;
  organizationId: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  _id: string;
  name: string;
  description?: string;
  organizationId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'member' | 'viewer';
  organizationId: string;
}
```

Now the compiler catches typos at build time:

```typescript
// This is a compile-time error
const task: Task = {
  title: 'Fix bug',
  status: 'in_progress',
  priority: 'urgent',
  projectId: 'proj_123',
  reporterId: 'user_456',
  organizationId: 'org_789',
};

// ERROR: Property 'assigneId' does not exist on type 'Task'.
// Did you mean 'assigneeId'?
task.assigneeId = 'user_999';
```

## The Organizational Benefit

With 5 engineers on the team, TypeScript becomes a contract. When Alice changes the `Task` interface, TypeScript tells Bob his controller is broken before he commits. The CI fails. The bug never reaches staging.

**Trade-off:** Build step added. Slower iteration for prototypes. But for a team SaaS, the safety is worth the 2-second compile delay.

## What Changed

| Before (JS) | After (TS) |
|-------------|------------|
| `req.body` is `any` | `req.body` is `CreateTaskDTO` |
| Runtime `undefined` errors | Compile-time property checks |
| No autocomplete in IDE | Full IntelliSense for models |
| `function(task)` — no hints | `function(task: Task)` — self-documenting |
| Refactors are manual grep | Refactors are automated with `tsc` |

## Next Pain

Types catch structural errors, but they don't catch semantic ones. A user can still send `{ priority: 'banana' }` and TypeScript won't stop it at runtime. You need validation.
