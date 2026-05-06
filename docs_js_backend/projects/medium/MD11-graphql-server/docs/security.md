# Security Guide

## Threat Model

### Asset Inventory
- User data (PII)
- Post content
- Authentication tokens
- Database credentials

### Threat Actors
- External attackers
- Malicious users
- Insider threats
- Automated bots

### Attack Vectors
- GraphQL injection
- Query-based DoS
- Information disclosure
- Authentication bypass

## Security Measures

### 1. Query Depth Limiting
Prevents recursive queries that crash the server.

**Status**: DISABLED (BUG)
```typescript
// Currently disabled - enable before production
```

**Recommended Setting**:
```typescript
queryDepthLimit: 10 // Maximum nesting depth
```

### 2. Query Complexity Analysis
Assigns cost scores to reject expensive queries.

**Implementation**:
```typescript
const complexityWeights = {
  users: 10,
  posts: 10,
  comments: 5,
};
```

**Limit**: 1000 complexity points per query

### 3. Persisted Queries
Only allow pre-registered queries.

**Benefits**:
- Prevents arbitrary query execution
- Reduces bandwidth
- Enables query whitelisting

**Implementation**:
```typescript
const persistedQueriesPlugin = {
  async requestDidStart() {
    return {
      async didResolveOperation({ request }) {
        if (!isPersistedQuery(request.query)) {
          throw new Error('Query not in whitelist');
        }
      },
    };
  },
};
```

### 4. Authentication
```typescript
context: async ({ req }) => {
  const token = req.headers.authorization;
  if (!token) throw new AuthenticationError('Missing token');
  return { userId: verifyToken(token) };
}
```

### 5. Authorization
```typescript
const resolvers = {
  Query: {
    user: async (_, { id }, { userId }) => {
      // Users can only query their own data
      if (id !== userId) throw new ForbiddenError('Access denied');
      return prisma.user.findUnique({ where: { id } });
    },
  },
};
```

### 6. Input Validation
```typescript
const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
});
```

### 7. Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

app.use('/graphql', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests
}));
```

### 8. CORS Configuration
```typescript
app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true,
}));
```

## Security Checklist

- [ ] Enable query depth limiting
- [ ] Set query complexity limits
- [ ] Use persisted queries in production
- [ ] Implement authentication
- [ ] Add authorization checks
- [ ] Validate all inputs
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Use HTTPS/WSS
- [ ] Rotate secrets regularly
- [ ] Enable audit logging
- [ ] Run security scans

## OWASP GraphQL Guidelines

1. **Injection Prevention**: Use parameterized queries
2. **DoS Prevention**: Limit depth and complexity
3. **Information Disclosure**: Disable introspection in production
4. **Authorization**: Implement field-level auth
5. **Input Validation**: Validate all arguments

## References

- OWASP GraphQL Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html
- Apollo Security: https://www.apollographql.com/docs/apollo-server/security/
- GraphQL Security Best Practices: https://graphql.org/learn/security/