# REST Conventions

## WHAT

REST (Representational State Transfer) is an architectural style defined by Roy Fielding in 2000. For APIs, it prescribes:

- **Resource identification:** Every resource has a URI (`/todos/123`).
- **Uniform interface:** Use standard HTTP methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
- **Statelessness:** Each request contains all information needed; no server-side session.
- **Representation:** Resources are exchanged as JSON, XML, etc.

## WHY

Following conventions reduces integration friction and enables HTTP infrastructure:

- **Caching:** `GET` responses can be cached by proxies and browsers.
- **Idempotency:** Clients can safely retry `PUT` and `DELETE` on network errors.
- **Discoverability:** Consistent patterns allow SDK generation and documentation.

## HOW

**Resource naming:**

- Use nouns, plural: `/todos`, `/users`, `/projects`.
- Use path parameters for IDs: `/todos/:id`.
- Use query parameters for filtering, sorting, pagination: `/todos?completed=true&sort=-createdAt`.

**Status codes:**

| Scenario | Code |
|----------|------|
| Create success | `201 Created` |
| Read success | `200 OK` |
| Update success | `200 OK` or `204 No Content` |
| Delete success | `204 No Content` |
| Client error | `400 Bad Request` |
| Unauthorized | `401 Unauthorized` |
| Forbidden | `403 Forbidden` |
| Not found | `404 Not Found` |
| Conflict | `409 Conflict` |

**Example:**

```javascript
router.get("/todos", async (req, res) => {
  const { page = 1, limit = 20, completed } = req.query;
  const where = completed !== undefined ? { completed: completed === "true" } : {};
  const todos = await prisma.todo.findMany({ where, skip: (page - 1) * limit, take: +limit });
  res.json({ data: todos, meta: { page: +page, limit: +limit } });
});
```

## WRONG vs RIGHT

### WRONG: Verb-Based URLs

```javascript
// BAD: Verbs in URL, wrong method, wrong status
app.get("/createTodo", (req, res) => { ... });
app.get("/deleteTodo", (req, res) => { ... });
app.post("/getTodo", (req, res) => { ... });
```

### RIGHT: Resource-Based Routes

```javascript
// GOOD: Nouns + correct methods + correct statuses
app.post("/todos", createTodo);      // 201
app.get("/todos", listTodos);        // 200
app.get("/todos/:id", getTodo);      // 200
app.patch("/todos/:id", updateTodo); // 200
app.delete("/todos/:id", deleteTodo);// 204
```

### WRONG: Inconsistent Error Bodies

```javascript
res.status(500).send("Something broke");
res.status(404).json({ msg: "Not found" });
res.status(400).json({ error: "Bad input", details: [...] });
```

### RIGHT: Standard Error Envelope

```javascript
function errorResponse(status, code, message, details = null) {
  return res.status(status).json({ error: { code, message, details } });
}
errorResponse(404, "NOT_FOUND", "Todo does not exist.");
```

## Breach Story: Uber API — Broken Object Level Authorization (2018)

In 2018, security researchers found that Uber's API endpoints such as `GET /api/riders/{uuid}` lacked authorization checks, allowing any authenticated user to access other riders' trip details by changing the UUID in the URL. The root cause was treating UUIDs as opaque without verifying ownership — a REST resource-level authorization failure. Uber fixed it by adding middleware that validates resource ownership before every response.

## References

- Fielding, R. (2000). *Architectural Styles and the Design of Network-based Software Architectures*.
- Richardson, L., & Amundsen, M. (2013). *RESTful Web APIs*.
- OWASP API Security Top 10 2023 — API1:2023 Broken Object Level Authorization
