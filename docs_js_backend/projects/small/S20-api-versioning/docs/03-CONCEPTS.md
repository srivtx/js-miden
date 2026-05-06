# 03-CONCEPTS.md

## WHAT: API Versioning Core Concepts

### URL Path Versioning

```typescript
// WHAT: Version is part of the URL path
// WHY: Explicit, easy to route, cache-friendly
// HOW: Separate Express routers mounted on version prefixes

app.use('/v1', v1Router);
app.use('/v2', v2Router);

// v1Router.get('/users') -> GET /v1/users
// v2Router.get('/users') -> GET /v2/users
```

### Header Versioning

```typescript
// WHAT: Version is specified via Accept header
// WHY: URLs remain clean, content negotiation
// HOW: Parse header and route to appropriate handler

app.use((req, res, next) => {
  const accept = req.get('Accept') || '';
  
  if (accept.includes('application/vnd.api.v1+json')) {
    return v1Router(req, res, next);
  }
  if (accept.includes('application/vnd.api.v2+json')) {
    return v2Router(req, res, next);
  }
  
  next(); // Fall through to default routing
});
```

### Transformation Layer

```typescript
// WHAT: Convert data between version formats
// WHY: Maintain one canonical data model, derive older versions
// HOW: Pure functions mapping v2 -> v1 and v1 -> v2

interface UserV1 {
  id: string;
  name: string;
}

interface UserV2 {
  id: string;
  firstName: string;
  lastName: string;
}

function transformV2toV1(user: UserV2): UserV1 {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
  };
}

function transformV1toV2(user: UserV1): UserV2 {
  const parts = user.name.split(' ');
  return {
    id: user.id,
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || '',
  };
}
```

### Deprecation Headers

```typescript
// WHAT: HTTP headers signaling version lifecycle
// WHY: Clients need advance warning to migrate
// HOW: RFC 8594 Deprecation + Sunset headers

app.use('/v1', (req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Sat, 31 Dec 2025 23:59:59 GMT');
  res.set('Link', '</v2/users>; rel="successor-version"');
  next();
});
```

## WHY: Breaking Changes Destroy Trust

```
WRONG: Modify v1 in place

v1 GET /users used to return:
  [{ id: "1", name: "Alice Johnson" }]

Backend deploys "minor fix":
  [{ id: "1", firstName: "Alice", lastName: "Johnson" }]

Client impact:
  - iOS app: user.name is undefined -> crash
  - Web dashboard: displays "undefined undefined"
  - Partner integration: JSON parser fails
  - Revenue impact: immediate
```

```
RIGHT: Create v2, keep v1 stable

v1 GET /v1/users:
  [{ id: "1", name: "Alice Johnson" }]  # NEVER CHANGES

v2 GET /v2/users:
  [{ id: "1", firstName: "Alice", lastName: "Johnson" }]  # NEW VERSION

Client impact:
  - Legacy clients continue working
  - New clients opt into v2
  - Zero downtime, zero breakage
```

## HOW: Version Discovery

```
WHAT: Help clients find available API versions
WHY: Hardcoding version URLs is brittle
HOW: /versions endpoint or Link headers

GET /versions

Response:
{
  "versions": [
    {
      "version": "v1",
      "status": "deprecated",
      "sunset": "2025-12-31T23:59:59Z",
      "docs": "https://api.example.com/docs/v1"
    },
    {
      "version": "v2",
      "status": "stable",
      "latest": true,
      "docs": "https://api.example.com/docs/v2"
    }
  ]
}
```

## WRONG vs RIGHT: Versioning Discipline

```typescript
// WRONG: v1 returns v2 format (breaking change)
v1Router.get('/users', (req, res) => {
  res.json(usersV2);  // Clients expecting `name` get `firstName`!
});

// RIGHT: v1 is frozen, v2 is new
v1Router.get('/users', (req, res) => {
  res.json(usersV1);  // { name } — stable forever
});

v2Router.get('/users', (req, res) => {
  res.json(usersV2);  // { firstName, lastName } — new version
});
```

```typescript
// WRONG: No deprecation notice
v1Router.get('/users', (req, res) => {
  res.json(usersV1);  // Silent. Clients assume it's permanent.
});

// RIGHT: Deprecation headers
v1Router.get('/users', (req, res) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Sat, 31 Dec 2025 23:59:59 GMT');
  res.json(usersV1);
});
```
