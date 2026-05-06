# 04-OLD-VS-NEW.md

## 2015 Patterns vs 2025 Patterns

### Versioning Mechanism

**2015: URL Path Only**
```javascript
// Simple but rigid
app.get('/v1/users', handler);
app.get('/v2/users', handler);
```

**2025: Content Negotiation + URL**
```typescript
// Flexible, supports gradual migration
app.use(acceptVersioning({
  'application/vnd.api.v1+json': v1Router,
  'application/vnd.api.v2+json': v2Router,
}));
```

**2025: GraphQL (Versionless)**
```graphql
# GraphQL deprecates fields, not entire versions
# Old queries continue working

type User {
  id: ID!
  name: String @deprecated(reason: "Use firstName and lastName")
  firstName: String
  lastName: String
}
```

### Deprecation

**2015: Blog Post**
```
"Hey developers, we're shutting off v1 next month. Good luck!"
```

**2025: RFC 8594 + Automated Alerting**
```typescript
// Machine-readable deprecation
res.set('Deprecation', 'true');
res.set('Sunset', new Date('2026-01-01').toUTCString());
res.set('Link', '</v2/users>; rel="successor-version"');

// Client SDKs automatically log warnings
console.warn(`API v1 is deprecated. Migrate by ${sunsetDate}`);
```

### Transformation

**2015: Inline Logic**
```javascript
// Ad-hoc transformations scattered across routes
if (version === 'v1') {
  res.json({ name: user.firstName + ' ' + user.lastName });
}
```

**2025: Dedicated Transformation Layer**
```typescript
// Centralized, testable, schema-aware
class UserTransformer {
  toV1(user: UserV2): UserV1 {
    return { id: user.id, name: `${user.firstName} ${user.lastName}` };
  }
  
  toV2(user: UserV1): UserV2 {
    const [firstName, ...rest] = user.name.split(' ');
    return { id: user.id, firstName, lastName: rest.join(' ') };
  }
}
```

**2025: OpenAPI / JSON Schema-Driven**
```yaml
# Schema definitions generate transformations and validation
openapi: 3.0.0
paths:
  /v1/users:
    get:
      responses:
        200:
          content:
            application/json:
              schema: { $ref: '#/components/schemas/UserV1' }
  /v2/users:
    get:
      responses:
        200:
          content:
            application/json:
              schema: { $ref: '#/components/schemas/UserV2' }
```

### Testing

**2015: Test Latest Only**
```javascript
// Only v2 tested. v1 breaks silently.
describe('GET /v2/users', () => { ... });
```

**2025: Contract Testing All Versions**
```typescript
// Pact or similar verifies all versions
for (const version of ['v1', 'v2']) {
  describe(`GET /${version}/users`, () => {
    it('matches contract', async () => {
      const response = await request(app).get(`/${version}/users`);
      expect(response.body).toMatchSchema(`${version}-users-schema.json`);
    });
  });
}
```

### Infrastructure

**2015: Monolithic Version Support**
```
Single codebase handles all versions
```

**2025: API Gateways + Microservices**
```
Client -> API Gateway (routing) -> v1 Service (legacy)
                                -> v2 Service (modern)
                                -> v3 Service (experimental)
                                
Each version can be a separate deployable unit.
```

### Documentation

**2015: Static Markdown**
```markdown
# API Docs (probably outdated)
```

**2025: Auto-Generated from OpenAPI**
```typescript
// Swagger UI, Redoc, Stoplight
// Generated from code annotations or schema files
// Always in sync with implementation
```
