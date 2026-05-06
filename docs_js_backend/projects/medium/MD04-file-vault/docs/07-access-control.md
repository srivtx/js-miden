# Access Control (RBAC)

## Role-Based Access Control (RBAC)
RBAC assigns permissions to **roles**, and roles to **users**. This is simpler and more maintainable than assigning permissions directly to users.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │────▶│   Role      │────▶│ Permission  │────▶│   Action    │
│   Alice     │     │   Owner     │     │  file:read  │     │  Download   │
│   Bob       │────▶│   Editor    │────▶│  file:write │     │  Upload     │
│   Carol     │────▶│   Viewer    │────▶│  file:share │     │  Share      │
│   Dave      │────▶│   Auditor   │────▶│  audit:read │     │  View logs  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

## Permission Granularity

Use **resource-level** permissions:

```
file:read      — view/download a specific file
file:write     — upload/overwrite a specific file
file:delete    — delete a specific file
file:share     — grant access to others
file:admin     — change ownership, rotate keys
audit:read     — view audit logs for a file
vault:admin    — global admin (rarely granted)
```

## Implementation (Prisma + Middleware)

```prisma
model User {
  id        String @id @default(uuid())
  email     String @unique
  roles     RoleAssignment[]
}

model File {
  id        String @id @default(uuid())
  ownerId   String
  shares    Share[]
}

model RoleAssignment {
  id        String @id @default(uuid())
  userId    String
  fileId    String?
  role      Role   // OWNER, EDITOR, VIEWER, AUDITOR
  scope     String // "global" or fileId
}

enum Role {
  OWNER
  EDITOR
  VIEWER
  AUDITOR
}
```

```typescript
// Permission map
const ROLE_PERMISSIONS: Record<Role, string[]> = {
  OWNER:   ['file:read', 'file:write', 'file:delete', 'file:share', 'file:admin'],
  EDITOR:  ['file:read', 'file:write', 'file:share'],
  VIEWER:  ['file:read'],
  AUDITOR: ['audit:read'],
};

export function can(userId: string, fileId: string, action: string): Promise<boolean> {
  // 1. Check direct ownership
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (file?.ownerId === userId) return true;

  // 2. Check role assignments
  const assignments = await prisma.roleAssignment.findMany({
    where: { userId, OR: [{ fileId }, { scope: 'global' }] },
  });

  for (const assignment of assignments) {
    const perms = ROLE_PERMISSIONS[assignment.role];
    if (perms.includes(action)) return true;
  }

  return false;
}
```

## Deny by Default

Every access check must **deny by default**. Never assume a missing permission means "allow".

```typescript
// BAD: implicit allow
if (user.isBanned) return 403;
// If the check is skipped, access is granted.

// GOOD: explicit allow
const allowed = await can(user.id, fileId, 'file:read');
if (!allowed) return 403;
```

## Attribute-Based Access Control (ABAC) Extension

For more complex rules, combine RBAC with attributes:

```typescript
function canAccess(user: User, file: File, action: string): boolean {
  // RBAC check
  if (!hasRolePermission(user.role, action)) return false;

  // ABAC checks
  if (file.classification === 'TOP_SECRET' && !user.clearedForTopSecret) return false;
  if (file.department !== user.department && user.role !== 'ADMIN') return false;
  if (file.expiresAt && file.expiresAt < new Date()) return false;

  return true;
}
```

## OWASP Reference

> "Deny by default — all access control decisions should default to denial. Access should only be granted explicitly." — OWASP Authorization Cheat Sheet

> "Implement access control on the server side. Client-side checks can be bypassed." — OWASP Top 10 2021 — A01:2021-Broken Access Control

> "Log all access control failures and alert admins when appropriate." — OWASP ASVS V4.1
