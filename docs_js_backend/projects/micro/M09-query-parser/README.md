# M09 Query Param Parser

Express 5 + TypeScript (ESM) micro service.

## Endpoint

- `GET /search?query=hello&page=1&limit=10`

Returns a parsed response containing the query parameters.

## Quick start

```bash
npm install
npm run dev
```

## Test

```bash
npm test
```

## Design Notes (Phase 2-3)

- **Everything is a string initially**: Express `req.query` properties are strings (or arrays). Never assume numeric types without explicit coercion.
- **Validation**: `page` should be a positive integer, `limit` should be bounded (e.g., max 100) to prevent DoS from massive result sets.
- **Type coercion**: Use `Number()`, `parseInt()`, or a validation library like Zod before performing arithmetic.
- **XSS prevention**: Never reflect user input directly into HTML responses. Always escape output (or return JSON and let the client sanitize).
- **SQL injection**: If the `query` parameter is concatenated into raw SQL without parameterization, it becomes an injection vector.

## Known Bugs (intentional)

1. **No type coercion**: `page` and `limit` remain strings. `nextPage` is computed with `+` causing string concatenation (e.g., `page=1` → `"1" + 1` → `"11"`).
2. **No validation**: Negative `page` values and extremely large `limit` values are accepted, enabling potential DoS.
3. **XSS via reflection**: The `query` parameter is reflected directly into an HTML response without escaping or sanitization.
