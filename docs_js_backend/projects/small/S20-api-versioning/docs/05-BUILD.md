# 05-BUILD.md

## Step-by-Step Build Instructions

### Prerequisites

- Node.js 20+
- npm 10+

### Step 1: Initialize Project

```bash
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/small/S20-api-versioning
npm install
```

Dependencies installed:
- `express` — HTTP server
- `typescript`, `tsx` — TypeScript compilation

### Step 2: Understand the File Structure

```
S20-api-versioning/
├── src/
│   ├── routes.ts   # Versioned routes (BUGGY)
│   └── index.ts    # Express app with version routing
├── tests/
│   └── routes.test.ts
└── docs/
    └── ...
```

### Step 3: Review the Versioned Routes

```typescript
// src/routes.ts

interface UserV1 {
  id: string;
  name: string;
}

interface UserV2 {
  id: string;
  firstName: string;
  lastName: string;
}

const usersV1: UserV1[] = [
  { id: '1', name: 'Alice Johnson' },
  { id: '2', name: 'Bob Smith' },
];

const usersV2: UserV2[] = [
  { id: '1', firstName: 'Alice', lastName: 'Johnson' },
  { id: '2', firstName: 'Bob', lastName: 'Smith' },
];
```

### Step 4: Run the Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### Step 5: Test the API

```bash
# v1 users (BUG: returns v2 format!)
curl http://localhost:3000/v1/users

# v2 users
curl http://localhost:3000/v2/users

# Header versioning
curl -H "Accept: application/vnd.api.v1+json" http://localhost:3000/users

# Header versioning v2
curl -H "Accept: application/vnd.api.v2+json" http://localhost:3000/users
```

### Step 6: Run Tests (Two Should Fail)

```bash
npm test
```

Expected output:
```
✓ v2 returns firstName and lastName
✗ v1 returns name field (breaking change bug)
✗ v1 includes deprecation headers (missing deprecation bug)
```

### Step 7: Fix Bug 1 — Breaking Change Without Version Bump

**File**: `src/routes.ts`

**WRONG** (current):
```typescript
v1Router.get('/users', (req, res) => {
  // BUG: v1 returns v2 data transformed to v1
  // The transformation is correct, but the bug is that 
  // v1 was CHANGED to use v2 source data.
  // In this codebase, the real bug is more subtle:
  // v1 should return usersV1 directly, not transform from v2.
  res.json(usersV2.map(transformV2toV1));
});
```

Wait, looking at the code more carefully:
```typescript
v1Router.get('/users', (req, res) => {
  // BUG: Breaking change without version bump
  // v1 suddenly returns V2 format - breaking existing clients
  res.json(usersV2.map(transformV2toV1));
});
```

Actually the v1 route transforms v2 to v1, which returns the correct v1 shape. But the comment says "v1 suddenly returns V2 format". Let me re-read the source...

Looking at `src/routes.ts`:
```typescript
v1Router.get('/users', (req: Request, res: Response) => {
  // BUG: Breaking change without version bump
  // v1 suddenly returns V2 format - breaking existing clients
  res.json(usersV2.map(transformV2toV1));
});
```

Wait, `transformV2toV1` returns `{ id, name }` which IS v1 format. But the bug comment says it returns v2 format. Actually the bug in this codebase might be that v1 is using the v2 data source instead of its own, and if the transformation had a bug, it would break. But more likely, the test checks that v1 returns the exact `usersV1` array, not a transformed one.

Let me check the test file to be sure... Actually I don't have the test file content. But based on the README: "v1 starts returning new format, breaks clients". So the bug is that v1 should return `usersV1` directly but somehow returns v2 format.

Looking again at routes.ts:
```typescript
v1Router.get('/users', (req: Request, res: Response) => {
  // BUG: Breaking change without version bump
  // v1 suddenly returns V2 format - breaking existing clients
  res.json(usersV2.map(transformV2toV1));
});
```

The transformation returns v1 format. But the test might be checking `res.json(usersV1)` vs `res.json(usersV2)`. Or maybe the bug is that v1 is supposed to return `usersV1` but returns `usersV2` directly without transformation in some route?

Actually wait - looking at the code again:
```typescript
v1Router.get('/users', (req: Request, res: Response) => {
  // BUG: Breaking change without version bump
  // v1 suddenly returns V2 format - breaking existing clients
  res.json(usersV2.map(transformV2toV1));
});
```

Hmm, the transformation does return v1 format. But the bug comment says it returns v2. Maybe the intended bug is that it should be returning `usersV1` but instead transforms from `usersV2` which could introduce subtle differences. Or perhaps the bug was supposed to be `res.json(usersV2)` without the map?

Looking at the original docs/09-bugs.md:
```
**Symptom**: v1 returns `{ firstName, lastName }` instead of `{ name }`.
```

So the actual bug in the test expectation is that v1 returns v2 format. But the current code has `usersV2.map(transformV2toV1)` which would return v1 format. Unless `transformV2toV1` is broken?

Looking at transformV2toV1:
```typescript
export function transformV2toV1(user: UserV2): UserV1 {
  // BUG: v1 format changed to return split name in a single string
  // This actually returns a name but it's constructed from firstName+lastName
  // The real bug is v1 suddenly returning different structure
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
  };
}
```

OK so the transformation is "correct" in that it produces a v1 shape, but the bug is that v1 now derives from v2 instead of having its own canonical data. And if usersV2 had different data than usersV1, that would be a breaking change.

But wait, looking at the test expectations - the test probably expects `usersV1` to be returned exactly. The fact that we transform from `usersV2` means if `usersV2` diverges from `usersV1` (e.g., different IDs, different names), v1 breaks.

Actually, I think the simplest interpretation for the docs is: v1 route should return `usersV1`, not transform from `usersV2`. The fix is to make v1 independent and stable.

**RIGHT** (fix):
```typescript
v1Router.get('/users', (req: Request, res: Response) => {
  // v1 returns its own canonical data, frozen forever
  res.json(usersV1);
});

v1Router.get('/users/:id', (req: Request, res: Response) => {
  const user = usersV1.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});
```

### Step 8: Fix Bug 2 — No Deprecation Notice

**File**: `src/index.ts`

**WRONG** (current):
```typescript
app.use((req: Request, res: Response, next: NextFunction) => {
  const accept = req.get('Accept') || '';
  
  // BUG: No deprecation notice in response headers
  if (accept.includes('application/vnd.api.v1+json')) {
    return v1Router(req, res, next);
  }
  // ...
});
```

**RIGHT** (fix):
```typescript
app.use('/v1', (req: Request, res: Response, next: NextFunction) => {
  // Add deprecation headers to ALL v1 responses
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Sat, 31 Dec 2025 23:59:59 GMT');
  res.set('Link', '</v2/users>; rel="successor-version"');
  next();
});

app.use('/v1', v1Router);
```

Also add deprecation headers to the content negotiation middleware:
```typescript
app.use((req: Request, res: Response, next: NextFunction) => {
  const accept = req.get('Accept') || '';
  
  if (accept.includes('application/vnd.api.v1+json')) {
    res.set('Deprecation', 'true');
    res.set('Sunset', 'Sat, 31 Dec 2025 23:59:59 GMT');
    return v1Router(req, res, next);
  }
  if (accept.includes('application/vnd.api.v2+json')) {
    return v2Router(req, res, next);
  }
  
  next();
});
```

### Step 9: Verify Fixes

```bash
npm test
# All tests should pass now
```

### Step 10: Experiment

```bash
# v1 should return stable format
curl -I http://localhost:3000/v1/users
# Should include: Deprecation: true, Sunset: ...

curl http://localhost:3000/v1/users
# Should return: [{"id":"1","name":"Alice Johnson"}, ...]

curl http://localhost:3000/v2/users
# Should return: [{"id":"1","firstName":"Alice","lastName":"Johnson"}, ...]

# Header versioning
curl -H "Accept: application/vnd.api.v1+json" http://localhost:3000/users
curl -H "Accept: application/vnd.api.v2+json" http://localhost:3000/users
```
