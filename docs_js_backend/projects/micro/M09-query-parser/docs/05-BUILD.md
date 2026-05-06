# M09: Query Param Parser — Step-by-Step Build

## Step 1: Initialize Project

```bash
mkdir m09-query-parser && cd m09-query-parser
npm init -y
npm install express zod
npm install --save-dev nodemon
```

## Step 2: Create Basic Express Server

Create `server.js`:
```javascript
import express from 'express';
const app = express();
const PORT = 3000;

app.use(express.json());

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

## Step 3: Define the Query Schema

Create `schemas/querySchema.js`:
```javascript
import { z } from 'zod';

export const UserQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(200).optional(),
  sortBy: z.enum(['name', 'email', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('asc'),
  active: z.coerce.boolean().default(true),
});
```

## Step 4: Create the Parser Middleware

Create `middleware/parseQuery.js`:
```javascript
export function parseQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: result.error.flatten().fieldErrors,
      });
    }
    
    req.parsedQuery = result.data; // attach parsed, typed data
    next();
  };
}
```

## Step 5: Wire Up the Route

Update `server.js`:
```javascript
import { UserQuerySchema } from './schemas/querySchema.js';
import { parseQuery } from './middleware/parseQuery.js';

app.get('/users', parseQuery(UserQuerySchema), (req, res) => {
  const { page, limit, search, sortBy, order, active } = req.parsedQuery;
  
  // Use the strongly-typed parameters
  console.log({ page, limit, search, sortBy, order, active });
  
  res.json({
    data: [],
    meta: { page, limit, search, sortBy, order, active },
  });
});
```

## Step 6: Test Edge Cases

Test with curl:

```bash
# Valid request
curl "http://localhost:3000/users?page=2&limit=10&search=john"

# Invalid: negative page
curl "http://localhost:3000/users?page=-1"
# -> 400 Bad Request

# Invalid: limit too high
curl "http://localhost:3000/users?limit=999"
# -> 400 Bad Request

# Coercion: active=0 becomes false
curl "http://localhost:3000/users?active=0"
# -> active: false

# XSS attempt
curl "http://localhost:3000/users?search=<script>alert(1)</script>"
# -> Rejected (max length) or passed through (sanitize in template!)
```

## Step 7: Add Pagination Offset Calculation

Update the route:
```javascript
app.get('/users', parseQuery(UserQuerySchema), (req, res) => {
  const { page, limit } = req.parsedQuery;
  const offset = (page - 1) * limit; // 0-based offset
  
  // Use offset and limit in database query
  // db.query('SELECT * FROM users LIMIT ? OFFSET ?', [limit, offset]);
  
  res.json({ offset, limit, page });
});
```

## Step 8: Add Cursor Pagination Support (Optional)

Create `schemas/cursorSchema.js`:
```javascript
import { z } from 'zod';

export const CursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// Cursor is a base64-encoded JSON object
export function encodeCursor(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

export function decodeCursor(cursor) {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString());
}
```

## Sources
- Express Getting Started: https://expressjs.com/en/starter/hello-world.html
- Zod Error Handling: https://zod.dev/ERROR_HANDLING
