# N+1 Queries

## WHAT

The **N+1 query problem** occurs when an application executes:

1. One query to fetch a list of N parent records.
2. N additional queries — one for each record — to fetch related child data.

Total queries: **N + 1**.

Example: Fetch 100 todos, then query the user for each todo individually.

## WHY

N+1 queries destroy performance:

- **Latency:** Each round-trip to the database adds 1–5ms. 100 todos → 500ms overhead.
- **Database load:** Connection pools saturate.
- **Event loop blocking:** Serial async queries block the Node.js event loop.
- **Cost:** Cloud databases charge per I/O or vCPU time.

In GraphQL APIs, N+1 is an **amplification attack vector**: an attacker requests deeply nested fields, triggering exponential queries.

## HOW

**Solutions:**

1. **Eager loading (JOINs):** Fetch related data in a single query.
2. **DataLoader:** Batches and deduplicates queries within a single tick.
3. **Prisma `include`:** Automatically generates optimal joins.

```javascript
// GOOD: Single query with JOIN (Prisma include)
const todos = await prisma.todo.findMany({
  where: { deletedAt: null },
  include: { user: true }, // JOIN users table
  take: 100
});
// → 1 query, not 101
```

**DataLoader pattern:**

```javascript
const DataLoader = require("dataloader");

const userLoader = new DataLoader(async (userIds) => {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } }
  });
  return userIds.map(id => users.find(u => u.id === id));
});

// In resolver
const todo = { ... };
const user = await userLoader.load(todo.userId); // Batched per tick
```

## WRONG vs RIGHT

### WRONG: Query in a Loop

```javascript
// BAD: 101 queries for 100 todos
app.get("/todos", async (req, res) => {
  const todos = await prisma.todo.findMany({ take: 100 });
  for (const todo of todos) {
    todo.user = await prisma.user.findUnique({ where: { id: todo.userId } });
  }
  res.json({ data: todos });
});
```

### RIGHT: Eager Load or DataLoader

```javascript
// GOOD: 1 query
app.get("/todos", async (req, res) => {
  const todos = await prisma.todo.findMany({
    take: 100,
    include: { user: true }
  });
  res.json({ data: todos });
});
```

## Timeline: N+1 as DoS Amplification

```
Time ─────────────────────────────────────────────────>

Attacker: ──[GraphQL query: 10 projects × 10 repos × 10 commits]──→
                                                              │
Server:     [Query 1: projects]                               │
            [Query 2: repos for proj_1]                       │
            [Query 3: repos for proj_2]                       │
            ...                                               │
            [Query 101: commits for repo_99]                  │
            [Query 102: commits for repo_100]                 │
                                                              │
Result: 1000+ queries in < 1 second. DB CPU 100%. Service down.

Mitigation:
  - Use DataLoader batching.
  - Enforce query depth limits and complexity scoring.
```

## Breach Story: GraphQL N+1 DoS Attacks (2016–2020)

Multiple bug bounty reports demonstrated that N+1 in GraphQL resolvers is a reliable DoS vector. In 2019, a researcher showed that a popular e-commerce platform's GraphQL endpoint allowed a single query to trigger 4,000+ SQL queries by nesting `products → variants → inventory → warehouse` without batching. The platform fixed it by implementing DataLoader and a query complexity limit of 1,000 "points."

## References

- OWASP API Security Top 10 2023 — API4:2023 Unrestricted Resource Consumption
- Facebook: DataLoader — https://github.com/graphql/dataloader
- Prisma Docs: Relation queries — https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries
- Cheney, D. (2013). *What is the N+1 problem?*
