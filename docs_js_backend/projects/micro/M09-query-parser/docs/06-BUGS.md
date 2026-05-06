# M09: Query Param Parser — Bug Deep Dive

## Bug 1: Type Coercion Bug ("1" + 1 = "11")

**WHAT:** JavaScript's `+` operator concatenates when one operand is a string.

**Reproduction:**
```javascript
const page = req.query.page; // "2" (string from query)
const nextPage = page + 1;   // "21"
```

**Root Cause:** `req.query` values are always strings in Express (unless `express.urlencoded({ extended: true })` is used, but even then, arrays are strings).

**WRONG:**
```javascript
const offset = req.query.page * req.query.limit; // "2" * "10" = 20 (works by accident)
const nextPage = req.query.page + 1;             // "2" + 1 = "21" (bug!)
```

**RIGHT:**
```javascript
const page = parseInt(req.query.page, 10); // 2
const limit = parseInt(req.query.limit, 10); // 10
const nextPage = page + 1; // 3
```

Or with Zod:
```javascript
const schema = z.object({
  page: z.coerce.number(),
});
const { page } = schema.parse(req.query); // guaranteed number
```

## Bug 2: XSS via Query Parameter Reflection

**WHAT:** An attacker injects JavaScript via a query parameter that gets rendered in the response HTML.

**Attack URL:**
```
GET /search?q=<script>alert('XSS')</script>
```

**Vulnerable Code:**
```javascript
app.get('/search', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Search results for: ${req.query.q}</h1>
      </body>
    </html>
  `);
});
```

**Result:** The browser executes the script. In a real attack, the script steals cookies or performs actions on behalf of the user.

**WRONG:**
```javascript
res.send(`<div>${req.query.q}</div>`); // Raw interpolation
```

**RIGHT:**
```javascript
// 1. Escape output
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
res.send(`<div>${escapeHtml(req.query.q)}</div>`);

// 2. Or use a template engine that escapes by default (EJS, Pug)
// 3. Or validate that q matches a safe pattern
const SafeString = z.string().regex(/^[a-zA-Z0-9\s]+$/);
```

## Bug 3: Negative Pagination

**WHAT:** Users provide negative values for `page` or `limit`, causing invalid SQL or unexpected behavior.

**Reproduction:**
```bash
curl "/users?page=-1&limit=-100"
```

**Vulnerable Code:**
```javascript
const offset = (req.query.page - 1) * req.query.limit;
// (-1 - 1) * -100 = 200 (nonsense)
db.query(`LIMIT ${req.query.limit}`); // LIMIT -100 (syntax error in some DBs)
```

**WRONG:**
```javascript
const page = req.query.page || 1;
const limit = req.query.limit || 20;
// Negative values pass through!
```

**RIGHT:**
```javascript
const schema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});
```

## Bug 4: SQL Injection via Unvalidated Enum

**WHAT:** A query parameter is interpolated into SQL without validation.

**Attack:**
```bash
curl "/users?sortBy=id; DROP TABLE users;--"
```

**Vulnerable Code:**
```javascript
db.query(`SELECT * FROM users ORDER BY ${req.query.sortBy}`);
```

**WRONG:** Interpolating any query parameter into SQL.

**RIGHT:**
```javascript
const schema = z.object({
  sortBy: z.enum(['name', 'email', 'createdAt']),
});
const { sortBy } = schema.parse(req.query);
db.query(`SELECT * FROM users ORDER BY ??`, [sortBy]); // parameterized
```

## Sources
- OWASP Top 10 2021 --- Injection: https://owasp.org/Top10/A03_2021-Injection/
- MDN parseInt: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt
