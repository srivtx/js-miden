# v2 — Add TypeScript (Todo API)

## The Scenario

It's 2am. Your junior just spent 3 hours debugging why a todo has `titel` instead of `title`. "JavaScript doesn't care," they mutter. You hand them TypeScript.

## The PAIN: Dynamic Typing at Scale

From v1, we had this bug:

```javascript
app.post('/todos', (req, res) => {
  const todo = {
    id: todos.length + 1,
    title: req.body.titel, // <-- typo. JavaScript: "undefined? sure."
    done: false,
  };
});
```

This compiles. Runs. Stores `undefined`. You find out in production when users see todos with no title.

### More typos that bite you:

```javascript
// Wrong property access
todo.completed // undefined (real property is 'done')

// Wrong method name
todos.pusH(todo) // TypeError: todos.pusH is not a function

// ID as string vs number
todos.find(t => t.id === req.params.id) // "3" !== 3, always undefined
```

These runtime errors happen in production. Users see 500s. You see PagerDuty alerts. At 2am.

## The Solution: TypeScript

```typescript
// types.ts
export interface Todo {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'done';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  status?: 'pending' | 'done';
}
```

```typescript
// routes.ts
import { Request, Response } from 'express';
import { Todo, CreateTodoInput } from './types.js';

const todos: Todo[] = []; // Now the compiler knows the shape

app.post('/todos', (req: Request, res: Response) => {
  const input: CreateTodoInput = req.body;
  // ^ TypeScript knows 'title' is required, 'titel' is an error
  
  const todo: Todo = {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    status: input.status ?? 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  todos.push(todo);
  res.status(201).json(todo);
});
```

### What TypeScript catches at compile time:

| Bug | JavaScript | TypeScript |
|-----|-----------|------------|
| `req.body.titel` | Runtime `undefined` | **Compile error**: Property 'titel' does not exist |
| `todo.completed` | Runtime `undefined` | **Compile error**: Property 'completed' does not exist |
| `todos.pusH()` | Runtime TypeError | **Compile error**: Property 'pusH' does not exist |
| `id: todos.length + 1` | Works, but string/number mismatch later | **Type error**: Type 'number' not assignable to 'string' |
| Missing `status` field | Runtime `undefined` | **Compile error**: Property 'status' is missing |

## The New PAIN: Any Types

```typescript
// The lazy way (DON'T DO THIS)
app.post('/todos', (req: Request, res: Response) => {
  const todo = req.body as any; // "I don't care about types"
  todos.push(todo); // accepts literally anything
});
```

Using `as any` defeats the purpose. It's like wearing a seatbelt but unbuckling it before the crash.

## The Realization

> Junior: "The red squiggly line saved me from pushing a typo to production."
> 
> You: "That's not a bug — that's TypeScript doing its job. The real bug was the 47 other typos you already fixed before commit."

## Why this matters for the Todo API

Our data model evolves fast:
- v1: `{ id, title, done }`
- v2: `{ id, title, description, status, createdAt, updatedAt }`

Without types, you add `description` to the create endpoint but forget it in the update endpoint. With types, the compiler reminds you: *"Hey, Todo.description exists, but your update handler ignores it."*

But TypeScript only catches **developer** bugs. It does nothing when a **user** sends `{ title: 12345 }` or `{ title: "" }`. For that, we need validation.

## Next: v3 — Add Validation
