# Common Pitfalls

## WHAT

Even a "simple" Todo API is a minefield of design anti-patterns. This document covers the most dangerous and common mistakes.

## Pitfall 1: Wrong HTTP Methods

**WRONG:**
```javascript
app.get("/todos/create", createTodo);
app.get("/todos/delete", deleteTodo);
```

**RIGHT:**
```javascript
app.post("/todos", createTodo);
app.delete("/todos/:id", deleteTodo);
```

## Pitfall 2: No Input Validation

**WRONG:**
```javascript
app.post("/todos", async (req, res) => {
  const todo = await prisma.todo.create({ data: req.body });
  res.json(todo);
});
```

**RIGHT:**
```javascript
const schema = z.object({ title: z.string().min(1).max(200) });
app.post("/todos", async (req, res) => {
  const data = schema.parse(req.body);
  const todo = await prisma.todo.create({ data });
  res.status(201).json(todo);
});
```

## Pitfall 3: Unbounded Queries

**WRONG:**
```javascript
app.get("/todos", async (req, res) => {
  const todos = await prisma.todo.findMany();
  res.json(todos); // ALL rows
});
```

**RIGHT:**
```javascript
app.get("/todos", async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const todos = await prisma.todo.findMany({ take: limit, skip: ... });
  res.json({ data: todos, meta: { limit } });
});
```

## Pitfall 4: N+1 Queries

**WRONG:**
```javascript
const todos = await prisma.todo.findMany();
for (const t of todos) {
  t.user = await prisma.user.findUnique({ where: { id: t.userId } });
}
```

**RIGHT:**
```javascript
const todos = await prisma.todo.findMany({ include: { user: true } });
```

## Pitfall 5: Missing Object-Level Authorization

**WRONG:**
```javascript
app.get("/todos/:id", async (req, res) => {
  const todo = await prisma.todo.findUnique({ where: { id: req.params.id } });
  res.json(todo); // Any user can read any todo
});
```

**RIGHT:**
```javascript
app.get("/todos/:id", auth, async (req, res) => {
  const todo = await prisma.todo.findFirst({
    where: { id: req.params.id, userId: req.user.id }
  });
  if (!todo) return res.sendStatus(404);
  res.json(todo);
});
```

## Pitfall 6: No Transactions for Multi-Step Operations

**WRONG:**
```javascript
await db.order.create({ data: ... });
await db.inventory.decrement({ ... }); // May fail independently
```

**RIGHT:**
```javascript
await prisma.$transaction([
  prisma.order.create({ data: ... }),
  prisma.inventory.update({ data: { quantity: { decrement: 1 } } })
]);
```

## References

- OWASP API Security Top 10 2023
- Richardson, L. — RESTful Web APIs
- Prisma Docs: Transactions
