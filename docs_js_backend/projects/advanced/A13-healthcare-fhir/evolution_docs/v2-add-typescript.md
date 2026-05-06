# v2 — Add TypeScript (Healthcare FHIR)

## The Scenario

It's 2am. Your junior just spent 3 hours debugging why a patient's birth date is missing. "JavaScript doesn't care," they mutter. The client sent `birthDate` but the code reads `birthdate`. The FHIR resource is invalid. You hand them TypeScript.

## The PAIN: Dynamic Typing in Healthcare Data

From v1, we had this bug:

```javascript
app.post('/patients', (req, res) => {
  const patient = {
    id: patients.length + 1,
    name: req.body.name,
    birthDate: req.body.birthdate, // <-- typo. JavaScript: "undefined? sure."
    ssn: req.body.ssn,
  };
});
```

This compiles. Runs. Stores `undefined` as the birth date. The FHIR validator rejects the resource. The EHR integration fails. A patient's record is incomplete during an emergency.

### More typos that bite you:

```javascript
// Wrong property access
patient.medicalRecordNumber // undefined (real property is 'medicalRecordNumber')

// Wrong resource type
resourceType: 'Patent' // No error. Just invalid FHIR.

// Date as string vs Date object
patient.createdAt = '2024-01-01' // String where Date expected
```

These runtime errors happen in production. FHIR validators reject resources. Integrations break. At 2am, during a hospital go-live.

## The Solution: TypeScript

```typescript
// src/types.ts
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

```typescript
// src/routes/patient.ts
import type { Patient, CreatePatientInput } from '../types.js';

app.post('/patients', (req: Request, res: Response) => {
  const input: CreatePatientInput = req.body;
  // ^ TypeScript knows 'birthDate' is required, 'birthdate' is an error

  const patient: Patient = {
    id: crypto.randomUUID(),
    resourceType: 'Patient',
    name: input.name,
    birthDate: input.birthDate,
    gender: input.gender,
    ssn: input.ssn,
    phone: input.phone,
    address: input.address,
    medicalRecordNumber: input.medicalRecordNumber,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  patients.push(patient);
  res.status(201).json(patient);
});
```

### What TypeScript catches at compile time:

| Bug | JavaScript | TypeScript |
|-----|-----------|------------|
| `req.body.birthdate` | Runtime `undefined` | **Compile error**: Property 'birthdate' does not exist |
| `resourceType: 'Patent'` | Runtime accepted | **Compile error**: Type '"Patent"' not assignable |
| `patient.ssn = 12345` | Runtime number | **Compile error**: Type 'number' not assignable to 'string' |
| Missing `gender` field | Runtime `undefined` | **Compile error**: Property 'gender' is missing |
| `action: 'delet'` | Runtime accepted | **Compile error**: Type '"delet"' not assignable |

## The New PAIN: Any Types

```typescript
// The lazy way (DON'T DO THIS)
app.post('/patients', (req: Request, res: Response) => {
  const patient = req.body as any; // "I don't care about types"
  patients.push(patient); // accepts literally anything, including invalid FHIR
});
```

Using `as any` defeats the purpose. It's like disabling encryption because "it makes debugging harder."

## The Realization

> Junior: "TypeScript caught `birthdate` before I deployed. That typo would have created an invalid FHIR resource."
>
> You: "That's not a bug — that's TypeScript doing its job. In healthcare, an invalid resource can break EHR integrations and delay critical care."

## Why this matters for Healthcare FHIR

Our data model is strictly specified:
- v1: `{ id, name, birthDate, gender, ssn, phone, address }`
- v2: Full FHIR R4 Patient resource with `resourceType`, `medicalRecordNumber`, timestamps

Without types, you add `gender` to the create endpoint but forget it in the update endpoint. With types, the compiler reminds you: *"Hey, Patient.gender exists, but your update handler ignores it."*

But TypeScript only catches **developer** bugs. It does nothing when a **user** sends `{ ssn: 'not-a-ssn', birthDate: 'tomorrow' }`. For that, we need validation.

## Next: v3 — Add Validation
