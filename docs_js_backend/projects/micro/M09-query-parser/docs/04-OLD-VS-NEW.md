# M09: Query Param Parser — Old vs Modern

## Era 1: Manual Parsing (Pre-2010)

**WHAT:** Developers manually split the query string.

```javascript
// OLD WAY --- brittle, no encoding, no types
function parseQuery(url) {
  const query = {};
  const pairs = url.split('?')[1].split('&');
  for (const pair of pairs) {
    const [key, val] = pair.split('=');
    query[key] = val; // no decodeURIComponent!
  }
  return query;
}
```

**Problems:**
- No URL decoding (`%20` stays as `%20`).
- No handling of duplicate keys.
- No type coercion (everything is a string).
- Fragile: breaks on `?` in the value, missing `=`, etc.

## Era 2: URLSearchParams (ES6 / Node 7.5+)

**WHAT:** Native browser and Node.js API for query string manipulation.

```javascript
// Better, but still only strings
const params = new URLSearchParams(req.url.split('?')[1]);
const limit = params.get('limit'); // "20" (string)
const page = params.get('page');   // "2" (string)
```

**Problems:**
- All values are strings.
- No validation or constraints.
- No default values.
- `params.getAll('tag')` returns arrays for duplicates, but type is still string[].

## Era 3: Schema Validation (Zod, 2020+)

**WHAT:** Declare the expected shape, types, and constraints. Let the library parse and validate.

```javascript
// MODERN WAY --- type-safe, validated, self-documenting
import { z } from 'zod';

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  tags: z.string().transform(v => v.split(',')).optional(),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(['asc', 'desc']).default('asc'),
});

// Usage
const result = QuerySchema.safeParse(req.query);
if (!result.success) {
  return res.status(400).json({ errors: result.error.issues });
}
const { page, limit, tags } = result.data; // fully typed!
```

**Advantages:**
- **Type safety:** TypeScript infers the output type automatically.
- **Fail-fast:** Invalid requests are rejected before touching business logic.
- **Self-documenting:** The schema serves as documentation.
- **Refactoring safety:** Changing a parameter name causes TypeScript errors everywhere it's used.

## Comparison Table

| Feature | Manual Split | URLSearchParams | Zod Schema |
|---------|-------------|-----------------|------------|
| URL Decoding | Manual | Native | Native |
| Duplicate Keys | Lost | Arrays | Configurable |
| Type Coercion | None | None | Built-in |
| Range Validation | None | None | Declarative |
| Default Values | Manual | Manual | Built-in |
| TypeScript Types | None | None | Inferred |
| Error Messages | Manual | None | Structured |

## Migration Path

1. Identify all route handlers that read from `req.query`.
2. Extract query usage into Zod schemas.
3. Replace manual parsing with `schema.safeParse(req.query)`.
4. Add tests for edge cases (missing params, invalid types, injection payloads).
5. Remove manual validation code.

## WRONG vs RIGHT

**WRONG:** Continuing to use manual parsing in a modern Node.js project.
```javascript
const limit = req.query.limit || 20; // limit="abc" -> "abc" (truthy, not 20)
```

**RIGHT:** Using Zod for all query parameter handling.
```javascript
const limit = schema.parse(req.query).limit; // limit="abc" -> 400 Bad Request
```

## Sources
- URLSearchParams MDN: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams
- Zod Documentation: https://zod.dev/
