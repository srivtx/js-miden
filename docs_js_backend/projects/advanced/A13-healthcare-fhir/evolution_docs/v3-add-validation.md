# v3 — Add Validation (Healthcare FHIR)

## The Scenario

It's 2am. Your junior added TypeScript. "No more typos!" they celebrate. Then a client sends `POST /patients` with `{ birthDate: 'tomorrow', ssn: 'not-a-ssn', gender: 'unknown' }` and the API stores it. TypeScript didn't help — the runtime data was wrong.

## The PAIN: TypeScript Doesn't Validate Runtime Data

From v2:

```typescript
app.post('/patients', (req: Request, res: Response) => {
  const input: CreatePatientInput = req.body; // Type assertion = TRUST
  // Client sends: { birthDate: 'tomorrow', ssn: 'not-a-ssn', gender: 'unknown' }
  // TypeScript believes it's valid. The FHIR resource is garbage.
});
```

TypeScript is a compile-time guard. At runtime, `req.body` is whatever the client sent. A type assertion (`as CreatePatientInput`) is a lie we tell the compiler.

### Real bugs from production:

```json
// Client sends:
{ "birthDate": "tomorrow", "ssn": "not-a-ssn", "gender": "unknown" }
// Invalid date. Invalid SSN. Invalid gender. The EHR integration breaks.

{ "phone": "abc-def-ghij" }
// Not a phone number. The SMS reminder system crashes.

{ "name": "" }
// Empty name. The billing system generates a blank invoice.
```

## The Solution: Zod Schema Validation

```typescript
// src/routes/patient.ts
import { z } from 'zod';

const patientSchema = z.object({
  name: z.string().min(1).max(200),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  gender: z.enum(['male', 'female', 'other', 'unknown']),
  ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/, 'Must be XXX-XX-XXXX'),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, 'Invalid phone number'),
  address: z.string().min(1).max(500),
  medicalRecordNumber: z.string().min(1).max(100),
});
```

```typescript
app.post('/patients', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = patientSchema.parse(req.body);
    // ^ Zod validates AND transforms. parsed is guaranteed to match the schema.
    const patient = createPatient(parsed);
    res.status(201).json(patient);
  } catch (err) {
    next(err); // Goes to error handler
  }
});
```

### What Zod catches:

| Input | TypeScript alone | Zod validation |
|-------|---------------|----------------|
| `{ birthDate: 'tomorrow' }` | ❌ Accepts via assertion | **Error**: Must be YYYY-MM-DD |
| `{ ssn: 'not-a-ssn' }` | ❌ Accepts | **Error**: Must be XXX-XX-XXXX |
| `{ gender: 'invalid' }` | ❌ Accepts any string | **Error**: Invalid enum value |
| `{ name: '' }` | ❌ Accepts empty | **Error**: String must contain at least 1 character(s) |
| `{ phone: 'abc' }` | ❌ Accepts | **Error**: Invalid phone number |

## The PAIN of Naive Validation

```typescript
// The "I'll write it myself" approach (DON'T)
function validatePatient(body: any) {
  if (!body.name) throw new Error('Name required');
  if (!body.birthDate) throw new Error('Birth date required');
  // ... 50 more lines for every field
  // Forgot to check SSN format? Data quality issues.
  // Forgot to validate gender enum? FHIR validator rejects it.
}
```

Hand-rolled validation is:
- **Verbose**: 50 lines vs 10 lines of Zod
- **Inconsistent**: One endpoint checks formats, another doesn't
- **Untyped**: The "validated" output is still `any`

## The Zod Advantage: Types from Schemas

```typescript
// Derive TypeScript types FROM the schema (single source of truth)
type CreatePatientInput = z.infer<typeof patientSchema>;
// Equivalent to: { name: string; birthDate: string; gender: 'male' | 'female' | 'other' | 'unknown'; ... }
```

Now your TypeScript types and runtime validators are **the same thing**. Change the schema? Both update automatically.

## Validation Evolution in Healthcare FHIR

| Version | Validation | What breaks |
|---------|-----------|-------------|
| v1 (JS) | None | Everything |
| v2 (TS) | Type assertions | Runtime garbage enters EHR |
| v3 (Zod) | Schema parsing | Nothing (caught at boundary) |

## The Realization

> Junior: "Zod rejected a request with `birthDate: 'tomorrow'`. The error message even said 'Must be YYYY-MM-DD'."
>
> You: "That's the difference. TypeScript tells *you* about typos. Zod tells *users* about their mistakes. Both are necessary. In healthcare, one invalid FHIR resource can break an entire EHR integration and delay patient care."

## The Next PAIN

Validation catches data quality issues, but what about **your** bugs? What happens when the encryption service throws because of a key rotation? What happens when an unhandled promise rejection crashes the process during a hospital go-live?

## Next: v4 — Add Logging
