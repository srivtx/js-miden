# Multi-Tenancy Design

## Overview
TeamTask Pro uses a **Database-per-Tenant** approach at the document level, where each document stores an `organizationId` field. This provides a balance between isolation and operational simplicity.

## Tenant Isolation Strategy

### Document-Level Isolation
All tenant-scoped documents include an `organizationId` field:

```typescript
interface TenantDocument {
  organizationId: string; // Indexed field
  // ... other fields
}
```

### Indexes
```javascript
// Users collection
db.users.createIndex({ organizationId: 1, email: 1 });

// Tasks collection
db.tasks.createIndex({ organizationId: 1, projectId: 1 });
db.tasks.createIndex({ organizationId: 1, assigneeId: 1 });

// Projects collection
db.projects.createIndex({ organizationId: 1, status: 1 });

// Files collection
db.files.createIndex({ organizationId: 1, taskId: 1 });
```

## Row-Level Security (RLS) Implementation

### Current Approach: Application-Level Filtering
Queries must explicitly include `organizationId` filters:

```typescript
// Correct - filters by tenant
Task.find({ organizationId: user.organizationId, projectId });

// INCORRECT - leaks data across tenants
Task.findById(taskId); // Missing organizationId check!
```

### Best Practice: Repository Pattern
```typescript
class TenantRepository<T> {
  async findOne(model: Model<T>, query: any, orgId: string) {
    return model.findOne({ ...query, organizationId: orgId });
  }

  async find(model: Model<T>, query: any, orgId: string) {
    return model.find({ ...query, organizationId: orgId });
  }
}
```

## Why Not Schema-Per-Tenant?

| Aspect | Document-Level | Schema-Per-Tenant |
|--------|---------------|-------------------|
| Operational Complexity | Low | High |
| Migration Complexity | Single migration | Per-tenant migrations |
| Cross-tenant Queries | Possible | Complex |
| Resource Overhead | Shared | Higher |
| Isolation Guarantee | Application-enforced | Database-enforced |

## Known Vulnerabilities
See `07-security.md` for documented cross-tenant data leak bugs.
