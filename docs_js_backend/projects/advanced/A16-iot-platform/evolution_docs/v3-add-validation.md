# v3 — Add Validation (IoT Platform)

## The Scenario

It's 2am. Your junior added TypeScript. "No more typos!" they celebrate. Then a device sends `POST /telemetry` with `{ temperature: 9999, humidity: -50, deviceId: '' }` and the API stores it. TypeScript didn't help — the runtime data was wrong.

## The PAIN: TypeScript Doesn't Validate Runtime Data

From v2:

```typescript
app.post('/telemetry', (req: Request, res: Response) => {
  const input: CreateTelemetryInput = req.body; // Type assertion = TRUST
  // Device sends: { temperature: 9999, humidity: -50, deviceId: '' }
  // TypeScript believes it's valid. The sensor data is garbage.
});
```

TypeScript is a compile-time guard. At runtime, `req.body` is whatever the client sent. A type assertion (`as CreateTelemetryInput`) is a lie we tell the compiler.

### Real bugs from production:

```json
// Device sends:
{ "temperature": 9999, "humidity": -50, "deviceId": "" }
// Impossible temperature. Negative humidity. Empty device ID. The HVAC system breaks.

{ "deviceId": "fridge-001", "command": "reboot" }
// No authentication. Anyone can reboot any device.

{ "firmwareVersion": "<script>alert('xss')</script>" }
// XSS payload in metadata. The dashboard executes it.
```

## The Solution: Zod Schema Validation

```typescript
// src/routes/telemetry.routes.ts
import { z } from 'zod';

const telemetrySchema = z.object({
  deviceId: z.string().uuid(),
  temperature: z.number().min(-100).max(200), // Celsius
  humidity: z.number().min(0).max(100), // Percentage
  pressure: z.number().min(0).max(2000).optional(), // hPa
  timestamp: z.string().datetime().optional(),
});

const commandSchema = z.object({
  deviceId: z.string().uuid(),
  command: z.enum(['reboot', 'update', 'config']),
  payload: z.record(z.unknown()).optional(),
});
```

```typescript
app.post('/telemetry', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = telemetrySchema.parse(req.body);
    // ^ Zod validates AND transforms. parsed is guaranteed to match the schema.
    const reading = createTelemetryReading(parsed);
    res.status(201).json(reading);
  } catch (err) {
    next(err); // Goes to error handler
  }
});
```

### What Zod catches:

| Input | TypeScript alone | Zod validation |
|-------|---------------|----------------|
| `{ temperature: 9999 }` | ❌ Accepts via assertion | **Error**: Number must be less than or equal to 200 |
| `{ humidity: -50 }` | ❌ Accepts negative | **Error**: Number must be greater than or equal to 0 |
| `{ deviceId: '' }` | ❌ Accepts empty | **Error**: Invalid uuid |
| `{ command: 'destroy' }` | ❌ Accepts any string | **Error**: Invalid enum value |
| `{ firmwareVersion: '<script>' }` | ❌ Accepts | **Error**: Not in schema (if strict) |

## The PAIN of Naive Validation

```typescript
// The "I'll write it myself" approach (DON'T)
function validateTelemetry(body: any) {
  if (!body.deviceId) throw new Error('Device ID required');
  if (body.temperature > 1000) throw new Error('Temperature too high');
  // ... 50 more lines for every field
  // Forgot to check humidity bounds? Negative humidity accepted.
  // Forgot to validate command enum? Arbitrary commands accepted.
}
```

Hand-rolled validation is:
- **Verbose**: 50 lines vs 10 lines of Zod
- **Inconsistent**: One endpoint checks bounds, another doesn't
- **Untyped**: The "validated" output is still `any`

## The Zod Advantage: Types from Schemas

```typescript
// Derive TypeScript types FROM the schema (single source of truth)
type CreateTelemetryInput = z.infer<typeof telemetrySchema>;
// Equivalent to: { deviceId: string; temperature: number; humidity: number; pressure?: number; timestamp?: string }
```

Now your TypeScript types and runtime validators are **the same thing**. Change the schema? Both update automatically.

## Validation Evolution in the IoT Platform

| Version | Validation | What breaks |
|---------|-----------|-------------|
| v1 (JS) | None | Everything |
| v2 (TS) | Type assertions | Garbage sensor data enters pipeline |
| v3 (Zod) | Schema parsing | Nothing (caught at boundary) |

## The Realization

> Junior: "Zod rejected a reading with `temperature: 9999`. The error message even said 'Number must be less than or equal to 200'."
>
> You: "That's the difference. TypeScript tells *you* about typos. Zod tells *devices* about invalid data. Both are necessary. In an IoT platform, one invalid sensor reading can trigger incorrect automation and cause physical damage."

## The Next PAIN

Validation catches bad data, but what about **your** bugs? What happens when the MQTT broker disconnects? What happens when an unhandled promise rejection crashes the process during a factory emergency alert?

## Next: v4 — Add Logging
