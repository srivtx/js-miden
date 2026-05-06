# Bug Documentation

## Bug: Manager Can See All Employee Salaries

### Severity
**High** - Privacy violation, potential legal/compliance issues.

### Reproduction Steps

1. Login as any employee (e.g., `dev1@company.com` / `password123`)
2. Call `GET /api/employees` with JWT token
3. Observe response includes `salary` field for ALL employees
4. Repeat with manager account - same result

### Root Cause

The `EmployeeService.listEmployees()` method performs:

```typescript
async listEmployees() {
  return prisma.employee.findMany({
    include: { directReports: true, manager: true }
  });
}
```

This returns the complete Prisma model including `salary`, `email`, and other potentially sensitive fields. There is no parameter for the requesting user, no role check, and no field filtering.

### Code Location

File: `src/services/employee.service.ts`
Method: `listEmployees`
Lines: 6-17

Also affected:
File: `src/controllers/employee.controller.ts`
Method: `listEmployees`
Lines: 9-14

### Test Reproduction

File: `tests/employee.test.ts`
Test: `BUG: should expose all salaries to any user`

Run: `npm test -- tests/employee.test.ts`

### Fix Strategy

1. **Immediate**: Add `select` to Prisma query excluding salary
2. **Proper**: Implement role-aware field filtering service
3. **Robust**: Create explicit DTOs per role, never return DB models directly

### Prevention

- Always implement output DTOs
- Never return ORM models directly from API
- Audit all endpoints for sensitive field exposure
- Use tools like `tsoa` or `class-transformer` for automatic DTO mapping
