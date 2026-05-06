# v3 — Adding Validation

A user just searched with `?q=<script>alert(1)</script>`. Your frontend renders it. XSS.

Another user sent `?q=${'*'.repeat(1000000)}`. Your server hangs in `includes()` for 10 seconds. ReDoS.

## The Fix: Query Sanitization

You validate and sanitize every search query.

```ts
import { z } from 'zod';

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  category: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
});

app.get('/products', (req, res) => {
  const parse = SearchQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.errors });
  }

  const { q, category, minPrice, maxPrice } = parse.data;

  // Sanitize: remove HTML tags, limit special chars
  const sanitized = q.replace(/[<>]/g, '').trim();

  // ... perform search
});
```

Queries longer than 200 chars are rejected. HTML tags are stripped. Price filters must be positive numbers.

## The Bug

You sanitize the query, but your SQL query is still string-concatenated:

```ts
const sql = `SELECT * FROM products WHERE name LIKE '%${sanitized}%'`;
```

A user sends `q = "'; DROP TABLE products; --"`. Even with length limits, SQL injection is possible.

**Fix:** Parameterized queries.

```ts
const sql = 'SELECT * FROM products WHERE name ILIKE $1';
const results = await db.query(sql, [`%${sanitized}%`]);
```

**Next:** Let's add logging so you can see what users search for.
