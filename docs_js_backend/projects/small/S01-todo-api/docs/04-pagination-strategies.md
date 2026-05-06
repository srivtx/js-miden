# Pagination Strategies

## WHAT

Pagination limits the number of results returned in a single response. Three dominant strategies exist:

| Strategy | Mechanism | Pros | Cons |
|----------|-----------|------|------|
| **Offset** | `?page=2&limit=20` | Simple, random access | Slow at deep pages; inconsistent with concurrent inserts/deletes |
| **Cursor** | `?after=eyJpZCI6MTIzfQ` | Consistent, fast deep paging | No random access; cursor must encode sort state |
| **Keyset** | `?lastId=123&limit=20` | Fast, stable ordering | Cannot jump to arbitrary page |

## WHY

Unbounded `SELECT *` queries are a top cause of production outages:

- **Memory:** Loading 1M rows into Node.js can OOM the process.
- **Latency:** Large JSON serialization blocks the event loop.
- **Bandwidth:** Mobile clients choke on multi-megabyte responses.
- **Security:** Attackers use `?limit=999999` to scrape data (see Twitter case below).

## HOW

**Offset pagination (simplest):**

```javascript
const page = Math.max(1, parseInt(req.query.page, 10) || 1);
const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);

const todos = await prisma.todo.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: "desc" }
});
const total = await prisma.todo.count();
res.json({ data: todos, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
```

**Cursor pagination (recommended for infinite scroll):**

```javascript
const { after, limit = 20 } = req.query;
const decoded = after ? JSON.parse(Buffer.from(after, "base64").toString()) : null;

const todos = await prisma.todo.findMany({
  where: decoded ? { createdAt: { lt: new Date(decoded.createdAt) } } : {},
  take: +limit,
  orderBy: { createdAt: "desc" }
});

const nextCursor = todos.length === +limit
  ? Buffer.from(JSON.stringify({ createdAt: todos[todos.length - 1].createdAt })).toString("base64")
  : null;

res.json({ data: todos, meta: { nextCursor } });
```

## WRONG vs RIGHT

### WRONG: No Pagination or Unbounded Limit

```javascript
// BAD: Returns every row; vulnerable to scraping and DoS
app.get("/todos", async (req, res) => {
  const todos = await prisma.todo.findMany(); // ALL rows
  res.json(todos);
});
```

### RIGHT: Enforce Max Limit

```javascript
// GOOD: Hard cap on page size; always paginated
const MAX_LIMIT = 100;
app.get("/todos", async (req, res) => {
  const limit = Math.min(MAX_LIMIT, parseInt(req.query.limit, 10) || 20);
  const todos = await prisma.todo.findMany({ take: limit, skip: ... });
  res.json({ data: todos, meta: { limit } });
});
```

## Breach Story: Twitter API Phone Number Enumeration (2019)

In 2019, Twitter discovered that a bug in its "Upload your contacts" feature, combined with unbounded pagination, allowed attackers to upload massive lists of phone numbers and match them to Twitter accounts at scale. The endpoint did not enforce strict rate limits or pagination bounds, enabling the enumeration of millions of users. Twitter later restricted the feature and paid a $550,000 fine to the Irish DPC under GDPR.

## References

- OWASP API Security Top 10 2023 — API3:2023 Broken Object Property Level Authorization
- Markus Winand, *SQL Performance Explained* (Use The Index, Luke) — https://use-the-index-luke.com/
- RFC 8288 — Web Linking (`Link` header for pagination)
