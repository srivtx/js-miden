# Authentication & Authorization

## Authentication Flow

```
Client → POST /api/v1/auth/register
            ↓
Auth Service → Create Organization
            → Hash Password (bcrypt, 12 rounds)
            → Create User (role: owner)
            → Generate JWT
            ↓
Client ← { user, token }
```

## JWT Token Structure

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "organizationId": "507f1f77bcf86cd799439012",
  "role": "admin",
  "iat": 1700000000,
  "exp": 1700604800
}
```

## Role-Based Access Control (RBAC)

### Roles
| Role | Description | Permissions |
|------|-------------|-------------|
| **owner** | Organization creator | Full access, cannot be deleted |
| **admin** | Designated by owner | Manage users, projects, tasks |
| **member** | Standard user | Create/update assigned tasks |

### Permission Matrix
| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| Delete organization | ✓ | ✗ | ✗ |
| Modify owner role | ✗ | ✗ | ✗ |
| Modify admin/member roles | ✓ | ✓ | ✗ |
| Create projects | ✓ | ✓ | ✓ |
| Delete any project | ✓ | ✓ | ✗ |
| Assign tasks | ✓ | ✓ | ✗ |
| Update own tasks | ✓ | ✓ | ✓ |

## Token Validation
Every microservice validates JWT tokens independently using the shared secret:

```typescript
function authenticate(req, res, next) {
  const token = req.headers.authorization?.substring(7);
  const decoded = jwt.verify(token, JWT_SECRET);
  req.user = decoded;
  next();
}
```

## Security Considerations
- Tokens expire after 7 days
- Passwords hashed with bcrypt (12 salt rounds)
- Rate limiting on auth endpoints
- HTTPS required in production
