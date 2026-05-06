# M09: Query Param Parser — Problem Statement

## WHAT

Build a robust URL query parameter parser for a Node.js/Express backend that:
- Extracts query parameters from incoming requests
- Validates their presence, type, and constraints
- Coerces values to appropriate JavaScript types (numbers, booleans, dates)
- Sanitizes input to prevent injection attacks
- Supports pagination parameters (`page`, `limit`, `cursor`)

## WHY

Query parameters are the primary mechanism for filtering, sorting, and paginating REST API resources. They are **untrusted user input** that crosses the application boundary. A parser that fails to validate or coerce parameters correctly leads to:

- Runtime type errors (`"1" + 1 = "11"`)
- Security vulnerabilities (XSS, SQL injection)
- Resource exhaustion (negative pagination, excessive `limit`)
- Unpredictable API behavior

## HOW

1. Receive raw query string from `req.query` (Express) or `new URL(req.url).searchParams`
2. Define a Zod schema describing expected parameters, types, and constraints
3. Parse and coerce values against the schema
4. Return strongly-typed parameters or a structured error response
5. Apply default values for optional parameters (e.g., `limit = 20`)

## WRONG vs RIGHT

**WRONG:** Manual string splitting without validation
```javascript
// Dangerous: no validation, no coercion, vulnerable to injection
app.get('/users', (req, res) => {
  const limit = req.query.limit;     // string | undefined
  const page = req.query.page;       // string | undefined
  const offset = page * limit;       // "2" * "10" = 20 (accidentally works, but fragile)
  db.query(`SELECT * FROM users LIMIT ${limit}`); // SQL injection!
});
```

**RIGHT:** Schema-driven parsing with Zod
```javascript
// Safe: explicit types, constraints, sanitized input
import { z } from 'zod';

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sort: z.enum(['asc', 'desc']).default('asc'),
});

app.get('/users', (req, res) => {
  const result = QuerySchema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({ errors: result.error.flatten() });
  }
  const { page, limit, search, sort } = result.data; // fully typed
  // Use parameterized queries only
});
```

## Constraints & Scope

**In Scope:**
- Type coercion (string -> number, string -> boolean, string -> date)
- Range validation (min/max for numbers, length for strings)
- Enum validation for fixed values (`sort`, `order`)
- Pagination support (offset-based and cursor-based)
- Error formatting for client feedback

**Out of Scope:**
- Full SQL query builder (use parameterized queries)
- Authentication/authorization (handled by middleware)
- Caching layer (see M10)

## Sources
- Express.js Request API: https://expressjs.com/en/api.html#req.query
- Zod Documentation: https://zod.dev/
- OWASP Query Parameterization: https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html
