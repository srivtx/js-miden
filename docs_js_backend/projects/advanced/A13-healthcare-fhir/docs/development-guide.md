# Development Guide

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Project Structure

```
src/
  index.ts              # Express app
  config.ts             # Environment config
  types.ts              # FHIR types
  db.ts                 # In-memory storage
  middleware/
    auth.ts             # JWT + role checking
    audit.ts            # Audit logging middleware
  routes/
    patient.ts          # Patient CRUD
    observation.ts      # Observation CRUD
    encounter.ts        # Encounter CRUD
  services/
    encryption.ts       # Field-level encryption
    consent.ts          # Consent management
```

## Adding a New FHIR Resource

1. Define type in `types.ts`
2. Add storage methods in `db.ts`
3. Create route file in `routes/`
4. Register in `index.ts`
5. Add audit middleware
6. Write tests

## Encryption

Always encrypt PHI before storage:
```typescript
const encrypted = encrypt(ssn);
// Store encrypted
```

Decrypt only when serving to authorized user:
```typescript
res.json({ ...patient, ssn: decrypt(patient.ssn) });
```
