# S20 API Versioning — v7 Production Setup

## Connect to src/

This is the final state. All evolutions converge into a clean, production-ready structure.

### Directory Structure

```
S20-api-versioning/
├── src/
│   ├── index.ts            # Express app + version negotiation
│   └── routes.ts           # v1 and v2 route handlers
├── tests/
│   └── routes.test.ts      # Node.js test runner + supertest
├── evolution_docs/         # This documentation
├── package.json
├── tsconfig.json
└── dist/                   # Compiled JS (gitignored)
```

### Key Production Decisions

**1. URL Path Versioning**

```ts
// index.ts
app.use('/v1', v1Router);
app.use('/v2', v2Router);
```

Explicit version in the URL: `/v1/users`, `/v2/users`. No ambiguity.

**2. Content Negotiation (Accept Header)**

```ts
app.use((req: Request, res: Response, next: NextFunction) => {
  const accept = req.get('Accept') || '';
  if (accept.includes('application/vnd.api.v1+json')) {
    return v1Router(req, res, next);
  }
  if (accept.includes('application/vnd.api.v2+json')) {
    return v2Router(req, res, next);
  }
  next();
});
```

Clients can request a specific version via the `Accept` header.

**3. Transformation Layer**

```ts
export function transformV2toV1(user: UserV2): UserV1 {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
  };
}

export function transformV1toV2(user: UserV1): UserV2 {
  const parts = user.name.split(' ');
  return {
    id: user.id,
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}
```

Internal data is stored once (as V2). Each version endpoint transforms on the fly. No data duplication.

**4. Deprecation Headers**

```ts
// BUG: No deprecation notice in response headers
if (accept.includes('application/vnd.api.v1+json')) {
  return v1Router(req, res, next);
}
```

V1 should include `Deprecation` and `Sunset` headers so clients know to migrate.

**5. Self-execution Guard**

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT);
}
```

Tests import `{ app }` without starting the server.

### The Intentional Bugs (For Learning)

The source code contains two bugs:

**Bug 1: Breaking Change Without Version Bump**
```ts
v1Router.get('/users', (req: Request, res: Response) => {
  // BUG: Breaking change without version bump
  // v1 suddenly returns V2 format - breaking existing clients
  res.json(usersV2.map(transformV2toV1));
});
```

V1 should return `UserV1[]` with `{ name }`, but the transform is present. The real bug is that if someone removes `transformV2toV1`, v1 clients break.

**Bug 2: No Deprecation Notice**
```ts
// BUG: No deprecation notice in response headers
if (accept.includes('application/vnd.api.v1+json')) {
  return v1Router(req, res, next);
}
```

V1 responses should include `Deprecation: true` and `Sunset: <date>` headers.

**Why are these here?** To demonstrate that API versioning without tests is worse than no versioning. The tests in `routes.test.ts` verify:
- V1 must return `{ name }`, not `{ firstName, lastName }`
- V1 must include deprecation headers

### Evolution Summary

| Version | Pain | Fix |
|---------|------|-----|
| v1 | Breaking changes kill clients | Wrote naive JS |
| v2 | Type errors in transformations | Added TypeScript |
| v3 | Invalid response shapes | Added runtime validation |
| v4 | Silent version usage | Added structured logging |
| v5 | Breaking change without detection | Added comprehensive version tests |
| v6 | Legacy module system | Full ESM alignment |
| v7 | Disorganized project | Clean `src/` structure |

### Running the Final Version

```bash
npm install
npm run dev      # node --watch --loader ts-node/esm src/index.ts
npm run build    # tsc
npm start        # node dist/index.js
npm test         # node --test tests/**/*.test.ts
```

**Note:** This project uses the Node.js built-in test runner (not Jest/Vitest) to demonstrate native ESM + TypeScript testing without external test frameworks.
