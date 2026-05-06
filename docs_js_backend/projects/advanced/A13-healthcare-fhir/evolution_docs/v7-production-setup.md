# v7 — Production Setup (Healthcare FHIR)

## The Scenario

It's 2am. Your junior deploys the FHIR API to production. "It works!" they say. Then the container restarts. All patient records vanish. All audit logs are gone. "But it was working..." they whimper. You check: in-memory arrays. No database. No persistence. Every deploy is a HIPAA violation.

## The PAIN: Development Data Is Not Production Data

From v6:

```typescript
const patients: Patient[] = []; // In-memory. Ephemeral. Dead on restart.
const auditEvents: AuditEvent[] = []; // Same problem. Compliance nightmare.
```

Local development can survive data loss. Production cannot. Patients have medical histories. Regulators require 6-year audit log retention. PHI must survive restarts.

### The evolution of persistence in this project:

| Version | Storage | Data survives restart? |
|---------|---------|----------------------|
| v1 | In-memory arrays | ❌ No |
| v2 | In-memory arrays | ❌ No |
| v3 | In-memory arrays | ❌ No |
| v4 | In-memory arrays | ❌ No |
| v5 | In-memory arrays | ❌ No |
| v6 | In-memory arrays | ❌ No |
| v7 | PostgreSQL + encrypted fields | ✓ Production-ready |

## The Solution: PostgreSQL + Encryption + Production Patterns

### 1. Database Schema (PostgreSQL)

```sql
-- migrations/001_initial.sql
CREATE TABLE patients (
  id UUID PRIMARY KEY,
  resource_type VARCHAR(50) NOT NULL DEFAULT 'Patient',
  name VARCHAR(200) NOT NULL,
  birth_date DATE NOT NULL,
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female', 'other', 'unknown')),
  ssn_encrypted TEXT NOT NULL,        -- AES-256-GCM encrypted
  phone_encrypted TEXT NOT NULL,      -- AES-256-GCM encrypted
  address_encrypted TEXT NOT NULL,    -- AES-256-GCM encrypted
  medical_record_number VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_mrn ON patients(medical_record_number);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete')),
  user_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET NOT NULL,
  user_agent TEXT
);

CREATE INDEX idx_audit_resource ON audit_events(resource_type, resource_id);
CREATE INDEX idx_audit_user ON audit_events(user_id, timestamp);
```

Why PostgreSQL?
- **ACID transactions**: Patient updates are atomic
- **Field-level encryption**: PHI encrypted at rest
- **Audit logging**: Immutable audit trail for compliance
- **Durability**: Write-ahead logging survives crashes

### 2. Encryption Service (Production)

```typescript
// src/services/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const key = scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32);

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decrypt(cipherText: string): string {
  const data = Buffer.from(cipherText, 'base64');
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const encrypted = data.subarray(32);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

### 3. Environment Configuration

```bash
# .env.example
DATABASE_URL="postgresql://user:pass@localhost:5432/healthcare?schema=public"
ENCRYPTION_KEY="change-me-to-32-characters-long!"
PORT=3000
LOG_LEVEL=info
JWT_SECRET="change-me-in-production"
```

### 4. Production Routes (connecting to src/)

```typescript
// src/routes/patient.ts (actual production code)
import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { encrypt, decrypt } from '../services/encryption.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const patientSchema = z.object({
  name: z.string().min(1).max(200),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  gender: z.enum(['male', 'female', 'other', 'unknown']),
  ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/, 'Must be XXX-XX-XXXX'),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, 'Invalid phone number'),
  address: z.string().min(1).max(500),
  medicalRecordNumber: z.string().min(1).max(100),
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = patientSchema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO patients (id, name, birth_date, gender, ssn_encrypted, phone_encrypted, address_encrypted, medical_record_number, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING id, resource_type, name, birth_date, gender, medical_record_number, created_at`,
      [
        crypto.randomUUID(),
        parsed.name,
        parsed.birthDate,
        parsed.gender,
        encrypt(parsed.ssn),
        encrypt(parsed.phone),
        encrypt(parsed.address),
        parsed.medicalRecordNumber,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});
```

### 5. Audit Middleware (Production)

```typescript
// src/middleware/audit.ts
export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = function(body) {
    pool.query(
      `INSERT INTO audit_events (id, resource_type, resource_id, action, user_id, timestamp, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
      [
        crypto.randomUUID(),
        req.path.split('/')[1] || 'unknown',
        body?.id || req.params.id || 'unknown',
        req.method === 'GET' ? 'read' : req.method === 'POST' ? 'create' : 'update',
        (req as any).userId || 'anonymous',
        req.ip || 'unknown',
        req.get('user-agent') || 'unknown',
      ]
    );
    return originalJson(body);
  };

  next();
}
```

### 6. Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "db:migrate": "node-pg-migrate up",
    "db:seed": "tsx scripts/seed.ts"
  }
}
```

## Production Checklist

| Concern | v1 | v7 (Production) |
|---------|-----|----------------|
| Persistence | In-memory arrays | PostgreSQL with WAL |
| Encryption | None | AES-256-GCM |
| Validation | None | Zod schemas |
| Types | None | TypeScript + generated types |
| Testing | None | Vitest + mocked database |
| Logging | console.log | Structured Pino |
| Module system | CommonJS | ESM |
| Data loss | Every restart | Survives forever |
| Audit | None | Immutable PostgreSQL logs |

## The Realization

> Junior: "I connected to PostgreSQL and suddenly patients survive restarts. Then I realized: every layer we added — types, validation, tests, ESM — was necessary to get here without breaking everything."
>
> You: "Production isn't one big change. It's seven small evolutions, each fixing the pain of the last. The array taught us persistence matters. The plaintext SSN taught us encryption matters. PostgreSQL + AES-256-GCM is where all those lessons converge. In healthcare, one data breach costs $1.5M and destroys patient trust."

## Files in this project

```
A13-healthcare-fhir/
├── src/
│   ├── index.ts          # Entry point (ESM)
│   ├── app.ts            # Express app setup
│   ├── routes/
│   │   ├── patient.ts      # CRUD + encryption
│   │   ├── observation.ts  # FHIR observations
│   │   └── encounter.ts    # FHIR encounters
│   ├── services/
│   │   ├── encryption.ts   # AES-256-GCM
│   │   └── consent.ts      # Consent management
│   ├── middleware/
│   │   ├── auth.ts         # JWT auth
│   │   └── audit.ts        # HIPAA audit logging
│   ├── utils/
│   │   └── logger.ts       # Pino structured logging
│   └── types.ts            # TypeScript interfaces
├── migrations/             # PostgreSQL migrations
├── .env.example
├── docker-compose.yml      # PostgreSQL
├── package.json            # ESM, scripts, dependencies
└── tsconfig.json           # NodeNext module resolution
```

## What You Learned

1. **Persistence evolution**: array → PostgreSQL. Each step taught a lesson.
2. **Encryption is non-negotiable**: PHI must be encrypted at rest and in transit.
3. **Tests document compliance**: The audit logging test proves every access is recorded.
4. **ESM is the future**: `"type": "module"` isn't a preference, it's a requirement for modern packages.
5. **HIPAA is a design constraint**: Audit logs, field-level encryption, and access control are not features — they are requirements.
