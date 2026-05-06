# v5 — Add Testing (Healthcare FHIR)

## The Scenario

It's 2am. Your junior refactors the patient access control. "Just moving some logic around," they say. They deploy. A nurse reports they can see every patient's SSN. Your junior stares at the code — it looks fine. But they never tested the authorization middleware.

## The PAIN: Silent Breakage on Refactor

From v4:

```typescript
// src/routes/patient.ts
router.get('/:id', (req: AuthRequest, res) => {
  const patient = getPatientById(req.params.id);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found' });
    return;
  }

  // BUG: During refactor, authorization check was accidentally removed
  // if (!canAccess(req.userId!, patient.id)) { return res.status(403)... }

  res.json({
    ...patient,
    ssn: decrypt(patient.ssn),
    phone: decrypt(patient.phone),
    address: decrypt(patient.address),
  });
});
```

This code has an **authorization bypass** (accidentally removed access check). Any authenticated user can access any patient's full PHI. HIPAA violation.

Without tests, this bug ships to production. Fines follow.

## The Solution: Vitest + Supertest + Mocks

```typescript
// tests/fhir.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { resetDb, getAuditEvents } from '../src/db.js';

function makeToken(userId: string, role = 'practitioner') {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'dev-secret');
}

describe('Healthcare FHIR API', () => {
  beforeEach(() => resetDb());

  describe('Patient Resources', () => {
    it('creates a patient', async () => {
      const res = await request(app)
        .post('/api/Patient')
        .set('Authorization', `Bearer ${makeToken('doctor-1')}`)
        .send({ name: 'John Doe', birthDate: '1980-01-01', gender: 'male', ssn: '123-45-6789', phone: '555-1234', address: '123 Main St', medicalRecordNumber: 'MRN001' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('John Doe');
    });

    it('masks SSN on create response', async () => {
      const res = await request(app)
        .post('/api/Patient')
        .set('Authorization', `Bearer ${makeToken('doctor-1')}`)
        .send({ name: 'John Doe', birthDate: '1980-01-01', gender: 'male', ssn: '123-45-6789', phone: '555-1234', address: '123 Main St', medicalRecordNumber: 'MRN001' });
      expect(res.body.ssn).toBe('***');
    });

    it('rejects invalid birthDate format', async () => {
      const res = await request(app)
        .post('/api/Patient')
        .set('Authorization', `Bearer ${makeToken('doctor-1')}`)
        .send({ name: 'John Doe', birthDate: 'tomorrow', gender: 'male', ssn: '123-45-6789', phone: '555-1234', address: '123 Main St', medicalRecordNumber: 'MRN001' });
      expect(res.status).toBe(400);
    });
  });

  describe('Audit Logging', () => {
    it('logs every patient data access', async () => {
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

    it('BUG: demonstrates authorization bypass if middleware removed', async () => {
      const doctorA = 'doctor-a';
      const doctorB = 'doctor-b';

      const createRes = await request(app)
        .post('/api/Patient')
        .set('Authorization', `Bearer ${makeToken(doctorA)}`)
        .send({ name: 'Jane Doe', birthDate: '1990-01-01', gender: 'female', ssn: '987-65-4321', phone: '555-5678', address: '456 Oak St', medicalRecordNumber: 'MRN002' });

      const patientId = createRes.body.id;
      const accessRes = await request(app)
        .get(`/api/Patient/${patientId}`)
        .set('Authorization', `Bearer ${makeToken(doctorB)}`);

      // If authorization is working, this should be 403
      // If bypass exists, this returns 200 with full PHI
      expect(accessRes.status).toBe(403);
    });
  });
});
```

### What testing catches:

| Scenario | Without tests | With tests |
|----------|--------------|------------|
| Refactor removes auth check | Deploy, HIPAA violation | **CI fails** before merge |
| Audit logging disabled | Compliance failure | **Test verifies** every access is logged |
| SSN returned unmasked | Data breach | **Test checks** masking on create |
| Invalid FHIR resource accepted | EHR integration break | **Test rejects** bad data |
| Schema changes | Runtime crashes | **Mock mismatch** alerts you |

## The PAIN of Database Testing

```typescript
// DON'T hit real database in unit tests
// - Slow (100ms+ per test)
// - Flaky (race conditions, state leakage)
// - Requires Docker/CI setup

// DO mock the database layer
// - Fast (<10ms per test)
// - Deterministic
// - Tests YOUR code, not the database
```

Mocking the database means:
- Your tests run in milliseconds
- No database setup required
- You control every response (error cases, missing patients, edge cases)

## Testing Evolution in Healthcare FHIR

| Version | Testing | Confidence |
|---------|---------|------------|
| v1 (JS) | Manual curl | Zero |
| v2 (TS) | Still manual | Zero |
| v3 (Validation) | Still manual | Zero |
| v4 (Logging) | Still manual | Zero |
| v5 (Vitest) | Automated, mocked, fast | High |

## The Realization

> Junior: "I wrote a test for the authorization bypass. It passes with 403. If someone removes the auth check, it fails. The test is a compliance guard rail."
>
> You: "Tests are documentation that executes. A passing test for HIPAA controls is a contract with your compliance officer. In healthcare, one untested refactor can cost $1.5M in fines."

## The Next PAIN

Tests protect your code. But your code runs in a module system from 2009. CommonJS (`require`) is legacy. ESM (`import`) is the 2025 standard. Mixing them causes subtle bugs.

## Next: v6 — Switch to ESM
