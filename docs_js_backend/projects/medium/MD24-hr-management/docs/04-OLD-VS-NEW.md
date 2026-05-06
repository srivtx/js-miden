# Old vs New Approach

## Old Approach (Buggy)

```typescript
// Controller
async listEmployees(req, res) {
  const employees = await prisma.employee.findMany({
    include: { directReports: true, manager: true }
  });
  res.json({ data: employees });  // Returns EVERYTHING including salary!
}
```

**Problems**:
- Returns database models directly to API
- No field filtering based on user role
- Salary exposed to all authenticated users
- Violates principle of least privilege

## New Approach (Fixed)

```typescript
// DTOs
interface PublicEmployeeDto {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  position: string;
  hireDate: Date;
  isActive: boolean;
  managerId?: string;
}

interface ManagerEmployeeDto extends PublicEmployeeDto {
  salary?: number;  // Only for direct reports
}

interface AdminEmployeeDto extends ManagerEmployeeDto {
  salary: number;   // Always visible
  email: string;
}

// Service
async listEmployees(requesterId: string) {
  const requester = await prisma.employee.findUnique({
    where: { id: requesterId },
  });

  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      department: true,
      position: true,
      hireDate: true,
      isActive: true,
      managerId: true,
      salary: true,  // Select but filter later
      email: true,
    },
  });

  return employees.map(emp => {
    // Role-based field filtering
    if (requester.role === 'ADMIN' || requester.role === 'HR') {
      return emp;  // Full access
    }

    if (requester.role === 'MANAGER' && emp.managerId === requesterId) {
      return { ...emp, email: undefined };  // Can see salary of direct reports
    }

    if (emp.id === requesterId) {
      return { ...emp, email: undefined };  // Can see own salary
    }

    // Regular employee viewing others
    const { salary, email, ...publicData } = emp;
    return publicData;
  });
}
```

**Improvements**:
- Explicit DTOs per role
- Server-side field filtering
- Principle of least privilege
- Type-safe output

## Alternative: Middleware Approach

```typescript
function filterFields(allowedFields: string[]) {
  return (req, res, next) => {
    const originalJson = res.json;
    res.json = function(data) {
      if (Array.isArray(data)) {
        data = data.map(item => pick(item, allowedFields));
      } else {
        data = pick(data, allowedFields);
      }
      return originalJson.call(this, data);
    };
    next();
  };
}

// Route
router.get('/', authenticate, filterFields(['id', 'name', 'position']), controller.listEmployees);
```
