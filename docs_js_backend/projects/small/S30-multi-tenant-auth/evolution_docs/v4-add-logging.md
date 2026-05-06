# v4-add-logging

## Goal
Audit every login attempt, registration, and tenant context switch.

## Changes
1. `pino` logger with request-level child.
2. Log login success/failure with `tenantId` and `email` (hashed in production).
3. Log token validation failures.

## Code

```ts
// src/services/auth.ts
import { logger } from '../logger.js';

export async function loginUser(email: string, password: string, tenantId: string): Promise<string> {
  const log = logger.child({ tenantId, email });
  const schema = `tenant_${tenantId}`;

  const result = await pool.query(`SELECT * FROM ${schema}.users WHERE email = $1`, [email]);
  const user = result.rows[0];
  if (!user) {
    log.warn('login_failed_user_not_found');
    throw new Error('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    log.warn('login_failed_password_mismatch');
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign({ userId: user.id, tenantId, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
  log.info('login_success');
  return token;
}
```

```ts
// src/middleware.ts
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth) {
    logger.warn('auth_missing_header');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // ...
}
```

## Decisions
- Hash `email` in production logs for GDPR compliance.
- Log tenantId on every auth event — essential for multi-tenant audit trails.

## Risks
- Failed login logging can leak valid emails if an attacker probes. Log only `tenantId` and a hashed `email`.
