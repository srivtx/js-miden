# Thinking Process

## Analyzing the Salary Exposure Bug

### The Data Exposure Pattern

This is a classic **Insecure Direct Object Reference (IDOR)** or more specifically **Horizontal Privilege Escalation** via data exposure.

The API returns:
```json
{
  "id": "...",
  "firstName": "John",
  "lastName": "Doe",
  "salary": 150000.00,  // SENSITIVE!
  "department": "Engineering",
  ...
}
```

To all users regardless of role.

### Why This Happens

1. **ORM convenience**: Prisma's `findMany()` returns all fields by default
2. **No output DTOs**: API returns database models directly
3. **Missing authorization layer**: No field-level access control
4. **Developer convenience**: Easier to return everything than specify fields

### Solution Approaches

1. **Field selection in queries**
```typescript
prisma.employee.findMany({
  select: { id: true, firstName: true, lastName: true, position: true }
});
```

2. **Output DTOs / View Models**
```typescript
class PublicEmployeeDto {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  // No salary!
}
```

3. **Field-level access control**
```typescript
const allowedFields = {
  ADMIN: ['*'],
  MANAGER: ['salary'], // Only for direct reports
  EMPLOYEE: [],
};
```

4. **GraphQL-style field filtering**
Allow client to request specific fields, but enforce server-side which fields are allowed per role.

### Role-Based Access Matrix

| Role | Own Salary | Direct Report Salaries | All Salaries | Others' Personal Info |
|------|-----------|----------------------|-------------|---------------------|
| ADMIN | Yes | Yes | Yes | Yes |
| HR | Yes | Yes | Yes | Yes |
| MANAGER | Yes | Yes | No | Limited |
| EMPLOYEE | Yes | No | No | Limited |

## Constraints

- Must not break existing API contracts unnecessarily
- Must be performant (don't make N+1 queries)
- Must handle org chart traversal (manager of manager)
- Must be maintainable (easy to add new sensitive fields)
