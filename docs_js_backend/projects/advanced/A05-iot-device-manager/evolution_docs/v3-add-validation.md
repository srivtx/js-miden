# v3 — Adding Validation

A device just registered with:

```json
{
  "id": "../../../etc/passwd",
  "name": "<script>alert('xss')</script>",
  "type": "hacker"
}
```

Your code stored it. The ID could be used for path traversal. The name renders in the admin panel. The type is meaningless. Your registry is poisoned.

## The Fix: Schema Validation

You validate every device registration and update.

```ts
import { z } from 'zod';

const DeviceIdSchema = z.string().regex(/^[a-zA-Z0-9-_]{1,64}$/);

const DeviceRegistrationSchema = z.object({
  id: DeviceIdSchema,
  name: z.string().min(1).max(100),
  type: z.enum(['sensor', 'actuator', 'gateway']),
  firmwareVersion: z.string().optional(),
});

const StatusUpdateSchema = z.object({
  status: z.enum(['online', 'offline', 'sleeping', 'error']),
  batteryLevel: z.number().min(0).max(100).optional(),
});

app.post('/devices', (req, res) => {
  const parse = DeviceRegistrationSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.errors });
  }
  // ...
});
```

Path traversal IDs are rejected. XSS names are blocked (and should be escaped in frontend anyway). Invalid types are rejected.

## Telemetry Validation

You also validate incoming telemetry payloads.

```ts
const TelemetrySchema = z.object({
  deviceId: DeviceIdSchema,
  timestamp: z.coerce.date(),
  temperature: z.number().optional(),
  humidity: z.number().min(0).max(100).optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
});
```

Humidity over 100% is rejected. Invalid timestamps are rejected.

**Next:** Let's add logging so you can trace every device interaction.
