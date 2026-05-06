# v4 — Add Logging (Healthcare FHIR)

## The Scenario

It's 2am. A hospital go-live is failing. Your junior stares at the console: "The last thing I see is `FHIR API running on port 3000`. Then nothing." A nurse reports patient records aren't loading. You check the logs. There are no logs. Just console output that vanished when the container restarted.

## The PAIN: Console.log Is Not Logging

From v3:

```typescript
app.post('/patients', (req, res, next) => {
  try {
    const parsed = patientSchema.parse(req.body);
    const patient = createPatient(parsed);
    console.log('Created patient:', patient.id); // <-- This is not logging
    res.status(201).json(patient);
  } catch (err) {
    console.error('Error:', err); // <-- This is also not logging
    next(err);
  }
});
```

### What breaks in production:

1. **No persistence**: `console.log` goes to stdout. Docker swallows it. Kubernetes rotates it. When the pod restarts, logs are gone. HIPAA requires 6-year audit log retention.

2. **No context**: `"Error: [object Object]"` — you logged an Error object with console.log. The stack trace is gone. You can't debug the encryption failure.

3. **No levels**: Every message is the same priority. A patient creation notification and a fatal crash look identical.

4. **No structure**: `"Created patient: abc123"` — good luck parsing that in your SIEM. You need JSON for log aggregation.

5. **No request tracing**: A compliance officer asks "who accessed this patient's SSN?" You have no correlation ID. You have no IP address. You have no user agent.

## The Solution: Structured Logging with Pino

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  // In production: output JSON for log aggregators
  // In dev: pretty print for humans
});
```

```typescript
// src/routes/patient.ts
import { logger } from '../utils/logger.js';

app.post('/patients', (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({ requestId, route: 'POST /patients', userId: req.userId });

  try {
    childLogger.info({ body: req.body }, 'Creating patient');
    const parsed = patientSchema.parse(req.body);

    const patient = createPatient(parsed);
    childLogger.info({ patientId: patient.id }, 'Patient created');

    res.status(201).json(patient);
  } catch (err) {
    childLogger.error({ err, body: req.body }, 'Failed to create patient');
    next(err);
  }
});
```

### Production log output:

```json
{
  "level": 30,
  "time": 1715000000000,
  "pid": 42,
  "hostname": "fhir-api-pod-7f8d9",
  "requestId": "abc-123-def",
  "route": "POST /patients",
  "userId": "doctor-42",
  "patientId": "pat-789",
  "msg": "Patient created"
}
```

### What structured logging gives you:

| Need | console.log | Pino |
|------|------------|------|
| Persist logs | ❌ Vanishes on restart | ✓ Writes to file/stdout (Docker/ELK captures) |
| Parse in SIEM | ❌ String grep | ✓ JSON fields |
| Filter by level | ❌ All mixed | ✓ `level >= 40` for errors only |
| Trace requests | ❌ Manual grep | ✓ `requestId` correlation |
| Performance | ❌ Synchronous (blocks event loop) | ✓ Asynchronous (buffered) |

## The PAIN of Silent Failures

```typescript
// Without logging:
app.get('/patients/:id', (req, res) => {
  const patient = getPatientById(req.params.id);
  res.json(patient);
  // Who accessed it? When? From what IP? HIPAA requires this.
});

// With logging:
app.get('/patients/:id', (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const childLogger = logger.child({
    requestId,
    route: 'GET /patients/:id',
    userId: req.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  try {
    childLogger.info({ patientId: req.params.id }, 'Accessing patient record');
    const patient = getPatientById(req.params.id);
    childLogger.info({ patientId: req.params.id }, 'Patient record accessed');
    res.json(patient);
  } catch (err) {
    childLogger.error({ err, patientId: req.params.id }, 'Failed to access patient record');
    next(err);
  }
});
```

## Logging Evolution in Healthcare FHIR

| Version | Logging | Visibility |
|---------|---------|------------|
| v1 (JS) | None | Blind |
| v2 (TS) | console.log | Ephemeral, unstructured |
| v3 (Zod) | console.log | Same problems |
| v4 (Pino) | Structured, async, leveled | Full observability |

## The Realization

> Junior: "I added Pino and suddenly I can see exactly which patient record was accessed, by whom, and when. In JSON."
>
> You: "Logs are your flight recorder. When a compliance officer asks 'who accessed this SSN?' at 3am, logs are the only witness. Console.log is a Post-it note. Pino is a black box. In healthcare, HIPAA requires you to keep those black boxes for 6 years."

## The Next PAIN

Logging tells you what broke. But you find out **after** it breaks. What if we could catch regressions **before** deployment? What if we could prove the audit middleware logs every access?

## Next: v5 — Add Testing
