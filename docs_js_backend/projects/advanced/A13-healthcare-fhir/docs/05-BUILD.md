# A13 Healthcare FHIR API: Build Guide

## Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Basic understanding of REST APIs and encryption

## Step 1: Project Setup

```bash
mkdir healthcare-fhir && cd healthcare-fhir
npm init -y
npm install express jsonwebtoken
npm install -D typescript vitest supertest @types/express @types/node
npx tsc --init
```

## Step 2: Type Definitions

Create `src/types.ts`:
```typescript
export interface Patient {
  id: string;
  resourceType: 'Patient';
  name: string;
  birthDate: string;
  gender: string;
  ssn: string;        // Encrypted
  phone: string;      // Encrypted
  address: string;    // Encrypted
  medicalRecordNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditEvent {
  id: string;
  resourceType: string;
  resourceId: string;
  action: 'create' | 'read' | 'update' | 'delete';
  userId: string;
  timestamp: Date;
  ipAddress: string;
  userAgent?: string;
}
```

## Step 3: Encryption Service (CORRECT)

Create `src/services/encryption.ts`:
```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const key = scryptSync(process.env.ENCRYPTION_KEY || 'default-key-at-least-32-characters-long!', 'salt', 32);

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

## Step 4: Audit Middleware (CORRECT)

Create `src/middleware/audit.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { createAuditEvent } from '../db.js';

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = function(body) {
    const pathParts = req.path.split('/').filter(Boolean);
    const resourceType = pathParts[0] || 'unknown';
    const resourceId = req.params.id || body?.id || 'unknown';

    createAuditEvent({
      id: crypto.randomUUID(),
      resourceType,
      resourceId,
      action: req.method === 'GET' ? 'read' : req.method === 'POST' ? 'create' : 'update',
      userId: (req as any).userId || 'anonymous',
      timestamp: new Date(),
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
    });

    return originalJson(body);
  };

  next();
}
```

## Step 5: Patient Routes (CORRECT)

Create `src/routes/patient.ts`:
```typescript
import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { auditMiddleware } from '../middleware/audit.js';
import { createPatient, getPatientById, getPatients } from '../db.js';
import { encrypt, decrypt } from '../services/encryption.js';

const router = Router();

router.use(authMiddleware);
router.use(auditMiddleware);

router.post('/', (req: AuthRequest, res) => {
  const { name, birthDate, gender, ssn, phone, address, medicalRecordNumber } = req.body;

  const patient = createPatient({
    id: crypto.randomUUID(),
    resourceType: 'Patient',
    name, birthDate, gender,
    ssn: encrypt(ssn),
    phone: encrypt(phone),
    address: encrypt(address),
    medicalRecordNumber,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  res.status(201).json({ ...patient, ssn: '***', phone: '***', address: '***' });
});

router.get('/:id', (req: AuthRequest, res) => {
  const patient = getPatientById(req.params.id);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found' });
    return;
  }

  res.json({
    ...patient,
    ssn: decrypt(patient.ssn),
    phone: decrypt(patient.phone),
    address: decrypt(patient.address),
  });
});

export { router as patientRouter };
```

## Step 6: Testing

Create `tests/fhir.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, getAuditEvents } from '../src/db.js';

function makeToken(userId: string, role = 'practitioner') {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'dev-secret');
}

describe('Healthcare FHIR API', () => {
  beforeEach(() => resetDb());

  it('should log every patient data access', async () => {
    const userId = 'doctor-1';
    const createRes = await request(app)
      .post('/api/Patient')
      .set('Authorization', `Bearer ${makeToken(userId)}`)
      .send({ name: 'John Doe', birthDate: '1980-01-01', gender: 'male', ssn: '123-45-6789', phone: '555-1234', address: '123 Main St', medicalRecordNumber: 'MRN001' });

    const patientId = createRes.body.id;
    await request(app).get(`/api/Patient/${patientId}`).set('Authorization', `Bearer ${makeToken(userId)}`);

    const audits = getAuditEvents();
    expect(audits.length).toBeGreaterThan(0);
    expect(audits.some(a => a.resourceType === 'Patient' && a.resourceId === patientId)).toBe(true);
  });
});
```

## Step 7: Run

```bash
npx vitest
```
