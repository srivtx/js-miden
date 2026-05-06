# CRUD Patterns

## WHAT

**CRUD** stands for Create, Read, Update, Delete — the four basic operations on persistent storage. In HTTP/REST, they map naturally to methods:

| Operation | HTTP Method | Idempotent | Safe |
|-----------|-------------|------------|------|
| Create    | POST        | No         | No   |
| Read      | GET         | Yes        | Yes  |
| Update    | PUT / PATCH | Yes (PUT)  | No   |
| Delete    | DELETE      | Yes        | No   |

## WHY

Using the wrong method or URL pattern leads to:

- **Security issues:** `GET /deleteTodo?id=1` can be triggered by email link previews or crawlers.
- **Caching issues:** Caches may store `GET` responses; mutating `GET` requests pollute caches.
- **Client confusion:** Non-standard conventions increase integration cost.

## HOW

**Standard route layout:**

```javascript
const router = require("express").Router();

router.post("/todos", createTodo);      // Create
router.get("/todos", listTodos);        // Read (list)
router.get("/todos/:id", getTodo);      // Read (single)
router.put("/todos/:id", replaceTodo);  // Update (full)
router.patch("/todos/:id", updateTodo); // Update (partial)
router.delete("/todos/:id", deleteTodo);// Delete (soft)
```

**Idempotency for updates:**

Use `If-Match` / `ETag` or conditional updates to prevent lost updates:

```javascript
// Client sends ETag from previous GET
PATCH /todos/123
If-Match: "abc123"
{ "title": "Buy milk" }

// Server rejects if resource changed since ETag
if (req.headers["if-match"] !== currentETag) {
  return res.status(412).json({ error: "Precondition Failed" });
}
```

## WRONG vs RIGHT

### WRONG: Mutating GET

```javascript
// BAD: Cacheable, safe method used for deletion
app.get("/todos/delete", (req, res) => {
  await prisma.todo.delete({ where: { id: req.query.id } });
  res.send("Deleted");
});
```

### RIGHT: Proper Method + Soft Delete

```javascript
// GOOD: Idempotent, non-cacheable, recoverable
app.delete("/todos/:id", async (req, res) => {
  await prisma.todo.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date() }
  });
  res.status(204).send();
});
```

### WRONG: No Input Validation

```javascript
// BAD: Trusts client input; allows SQL injection or invalid states
app.post("/todos", async (req, res) => {
  const todo = await prisma.todo.create({ data: req.body });
  res.json(todo);
});
```

### RIGHT: Schema Validation

```javascript
// GOOD: Validates and sanitizes input
const schema = z.object({
  title: z.string().min(1).max(200),
  completed: z.boolean().default(false),
});

app.post("/todos", async (req, res) => {
  const data = schema.parse(req.body);
  const todo = await prisma.todo.create({ data });
  res.status(201).location(`/todos/${todo.id}`).json(todo);
});
```

## Timeline: Lost Update Race Condition

```
Time ─────────────────────────────────────────>

Alice: ──[GET /todos/1]──→ receives v1 (title="A")
                               │
Bob:   ───────────────────[GET /todos/1]──→ receives v1 (title="A")
                               │                    │
Alice: ──[PUT /todos/1 {title="B"}]───────────────┘
                               │
Bob:   ────────────────────────[PUT /todos/1 {title="C"}]──→
                               │
Final state: title="C" (Alice's update "B" is lost silently)

Mitigation: Optimistic locking with ETag / version field.
```

## References

- RFC 7231 — Semantics and Content
- Fielding, R. (2000). *REST dissertation*
- OWASP API Security Top 10 2023 — API1:2023 Broken Object Level Authorization
