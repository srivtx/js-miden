# v2 — Add TypeScript (IoT Platform)

## The Scenario

It's 2am. Your junior just spent 3 hours debugging why temperature readings are missing. "JavaScript doesn't care," they mutter. The device sent `temperatre` instead of `temperature`. The dashboard shows `undefined°C`. You hand them TypeScript.

## The PAIN: Dynamic Typing in Sensor Data

From v1, we had this bug:

```javascript
app.post('/telemetry', (req, res) => {
  const { deviceId, temperatre, humidity } = req.body; // <-- typo
  telemetry.push({
    deviceId,
    temperatre, // Creates a new property 'temperatre'. Real property is 'temperature'.
    humidity,
    timestamp: new Date(),
  });
  res.json({ success: true }); // Dashboard shows undefined because it reads 'temperature'.
});
```

This compiles. Runs. Creates a ghost property `temperatre`. The real `temperature` is never stored. The dashboard shows `undefined°C`. The HVAC system makes incorrect decisions.

### More typos that bite you:

```javascript
// Wrong property access
device.firmwareVerson // undefined (real property is 'firmwareVersion')

// Numeric field as string
telemetry.temperature = "25.5" // String where number expected

// Missing device check
const device = devices[deviceId]; // Could be undefined
device.lastSeen = new Date(); // TypeError: Cannot set property 'lastSeen' of undefined
```

These runtime errors happen in production. Sensor data is corrupted. Automation fails. At 2am.

## The Solution: TypeScript

```typescript
// src/types/device.types.ts
export interface Device {
  id: string;
  name: string;
  firmwareVersion: string;
  metadata: Record<string, unknown>;
  registeredAt: Date;
  lastSeen?: Date;
}

export interface TelemetryReading {
  id: string;
  deviceId: string;
  temperature: number;
  humidity: number;
  timestamp: Date;
}

export interface DeviceCommand {
  id: string;
  deviceId: string;
  command: 'reboot' | 'update' | 'config';
  payload?: Record<string, unknown>;
  status: 'pending' | 'sent' | 'acknowledged' | 'failed';
  createdAt: Date;
}
```

```typescript
// src/controllers/telemetry.controller.ts
import type { TelemetryReading, CreateTelemetryInput } from '../types/telemetry.types.js';

export function ingestTelemetry(req: Request, res: Response) {
  const input: CreateTelemetryInput = req.body;
  // ^ TypeScript knows 'temperature' is required, 'temperatre' is an error

  const reading: TelemetryReading = {
    id: crypto.randomUUID(),
    deviceId: input.deviceId,
    temperature: input.temperature,
    humidity: input.humidity,
    timestamp: new Date(),
  };

  telemetry.push(reading);
  res.status(201).json(reading);
}
```

### What TypeScript catches at compile time:

| Bug | JavaScript | TypeScript |
|-----|-----------|------------|
| `req.body.temperatre` | Runtime ghost property | **Compile error**: Property 'temperatre' does not exist |
| `device.firmwareVerson` | Runtime `undefined` | **Compile error**: Property 'firmwareVerson' does not exist |
| `temperature: "25.5"` | Runtime string | **Compile error**: Type 'string' not assignable to 'number' |
| Missing `deviceId` field | Runtime `undefined` | **Compile error**: Property 'deviceId' is missing |
| `device.lastSeen = ...` without check | Runtime TypeError | **Compile error**: Object is possibly 'undefined' |

## The New PAIN: Any Types

```typescript
// The lazy way (DON'T DO THIS)
app.post('/telemetry', (req: Request, res: Response) => {
  const reading = req.body as any; // "I don't care about types"
  telemetry.push(reading); // accepts literally anything
});
```

Using `as any` defeats the purpose. It's like accepting any sensor reading because "the IoT device knows what it's doing."

## The Realization

> Junior: "TypeScript caught `temperatre` before I deployed. That typo would have corrupted every temperature reading."
>
> You: "That's not a bug — that's TypeScript doing its job. In an IoT platform, a typo in sensor data can cause incorrect automation decisions and physical damage."

## Why this matters for the IoT Platform

Our data model has many numeric sensor fields:
- v1: `{ deviceId, temperature, humidity }`
- v2: `{ id, deviceId, temperature, humidity, timestamp }`

Without types, you add `pressure` to the device firmware but forget it in the ingestion endpoint. With types, the compiler reminds you: *"Hey, TelemetryReading.pressure exists, but your ingestion handler ignores it."*

But TypeScript only catches **developer** bugs. It does nothing when a **device** sends `{ temperature: 9999, humidity: -50 }`. For that, we need validation.

## Next: v3 — Add Validation
