# 01-THINKING.md

## Mental Model

Think of a wishlist like a physical shopping list in your pocket. It belongs to you. No one else should read it, modify it, or add the same item twice. The store clerk (API) should only hand you your own list when you ask for it.

## Key Insights

### Insight 1: User isolation is not optional

Every multi-tenant system must enforce data boundaries at the storage layer. Relying on the frontend to "not show other users' data" is a security anti-pattern.

### Insight 2: Deduplication is a UX requirement

Users do not intend to add the same product twice. When it happens, they blame the app, not themselves. The system should prevent it.

### Insight 3: Composite constraints are the correct tool

A wishlist uniqueness constraint is not on `productId` alone (two users can wishlist the same product). It is on `(userId, productId)`. This is a composite unique constraint.

### Insight 4: Privacy regulations demand isolation

GDPR Article 32 requires appropriate technical measures to protect personal data. Exposing one user's wishlist to another is a reportable data breach under GDPR.

## Design Philosophy

- **Defense in depth**: Filter by userId in code AND enforce with database constraints
- **Fail fast**: Reject duplicates at the API layer with a clear 409 Conflict response
- **Authorization by default**: Every data access must include a userId check
- **Least privilege**: Endpoints should only return data the authenticated user owns

## Trade-offs Considered

| Isolation Level | Implementation | Performance | Security | Best For |
|-----------------|----------------|-------------|----------|----------|
| None (shared array) | No filtering | Fast | None | Never |
| Application filter | `filter(userId)` | Fast | Low | Prototypes |
| Row-level security | Postgres RLS | Medium | High | SaaS apps |
| Separate tables per user | `wishlist_user_123` | Slow | Very High | Compliance-heavy |

## ASCII: Security Layers

```
Request: GET /wishlist/user-a
        |
        v
+---------------+
| Auth Check    |  <-- Is the caller authenticated as user-a?
+---------------+
        |
        v
+---------------+
| User Filter   |  <-- WHERE user_id = 'user-a'
+---------------+
        |
        v
+---------------+
| DB Constraint |  <-- UNIQUE(user_id, product_id)
+---------------+
        |
        v
   Response

Three layers. Remove any one, and you have a bug.
```
