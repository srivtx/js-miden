# v7 — Production Setup (IoT Platform)

## The Scenario

It's 2am. Your junior deploys the IoT platform to production. "It works!" they say. Then the container restarts. All device registrations vanish. All telemetry history is gone. "But it was working..." they whimper. You check: in-memory objects. No time-series database. No MQTT persistence. Every deploy resets the entire device fleet.

## The PAIN: Development Data Is Not Production Data

From v6:

```typescript
const devices = {}; // In-memory. Ephemeral. Dead on restart.
const telemetry = []; // Same problem.
```

Local development can survive data loss. Production cannot. Devices are registered. Telemetry is collected. Commands are sent. An IoT platform without persistence is just a message logger.

### The evolution of persistence in this project:

| Version | Storage | Data survives restart? |
|---------|---------|----------------------|
| v1 | Plain objects | ❌ No |
| v2 | Plain objects | ❌ No |
| v3 | Plain objects | ❌ No |
| v4 | Plain objects | ❌ No |
| v5 | Plain objects | ❌ No |
| v6 | Plain objects | ❌ No |
| v7 | PostgreSQL + InfluxDB + MQTT | ✓ Production-ready |

## The Solution: PostgreSQL + InfluxDB + MQTT + Production Patterns

### 1. Database Schema (PostgreSQL)

```sql
-- migrations/001_initial.sql
CREATE TABLE devices (
  id UUID PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  firmware_version VARCHAR(50) NOT NULL,
  metadata JSONB,
  auth_token VARCHAR(255) UNIQUE NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ
);

CREATE TABLE device_commands (
  id UUID PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id),
  command VARCHAR(50) NOT NULL CHECK (command IN ('reboot', 'update', 'config')),
  payload JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'acknowledged', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX idx_commands_device ON device_commands(device_id, status);
```

Why PostgreSQL?
- **ACID transactions**: Device registrations are atomic
- **JSONB**: Flexible device metadata
- **Auth tokens**: Unique tokens for device authentication
- **Durability**: Write-ahead logging survives crashes

### 2. InfluxDB for Time-Series Data

```typescript
// src/services/timeseries.service.ts
import { InfluxDB, Point } from '@influxdata/influxdb-client';

const influxDB = new InfluxDB({ url: process.env.INFLUXDB_URL!, token: process.env.INFLUXDB_TOKEN! });
const writeApi = influxDB.getWriteApi(process.env.INFLUXDB_ORG!, 'telemetry');

export function writeTelemetry(deviceId: string, reading: TelemetryReading): void {
  const point = new Point('telemetry')
    .tag('deviceId', deviceId)
    .floatField('temperature', reading.temperature)
    .floatField('humidity', reading.humidity)
    .timestamp(new Date(reading.timestamp));

  writeApi.writePoint(point);
}
```

Why InfluxDB?
- **Time-series optimized**: 10,000+ writes per second
- **Retention policies**: Auto-expire old data
- **Downsampling**: Aggregate minute-level data to hour-level
- **Query performance**: `SELECT mean(temperature) FROM telemetry WHERE time > now() - 7d`

### 3. MQTT Broker (Production)

```yaml
# docker-compose.yml
services:
  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf
    environment:
      - ALLOW_ANONYMOUS=false
      - PASSWORD_FILE=/mosquitto/config/passwords.txt
```

```typescript
// src/services/mqtt.service.ts
import mqtt from 'mqtt';

const client = mqtt.connect(process.env.MQTT_BROKER_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});

client.on('connect', () => {
  client.subscribe('devices/+/telemetry');
  client.subscribe('devices/+/status');
});

client.on('message', (topic, message) => {
  const [_, deviceId, type] = topic.split('/');
  if (type === 'telemetry') {
    const reading = JSON.parse(message.toString());
    writeTelemetry(deviceId, reading);
  }
});
```

Why MQTT?
- **Pub/sub**: Efficient one-to-many message distribution
- **Low overhead**: 2-byte header minimum
- **QoS levels**: At-least-once delivery for commands
- **Battery friendly**: Devices sleep between messages

### 4. Environment Configuration

```bash
# .env.example
DATABASE_URL="postgresql://user:pass@localhost:5432/iot?schema=public"
INFLUXDB_URL="http://localhost:8086"
INFLUXDB_TOKEN="iot-token"
INFLUXDB_ORG="my-org"
MQTT_BROKER_URL="mqtt://localhost:1883"
MQTT_USERNAME="iot-bridge"
MQTT_PASSWORD="change-me-in-production"
REDIS_URL="redis://localhost:6379"
PORT=3000
LOG_LEVEL=info
```

### 5. Production Routes (connecting to src/)

```typescript
// src/routes/device.routes.ts (actual production code)
import { Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.post('/', async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(200),
      firmwareVersion: z.string().min(1).max(50),
      metadata: z.record(z.unknown()).optional(),
    });
    const parsed = schema.parse(req.body);

    const authToken = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO devices (id, name, firmware_version, metadata, auth_token, registered_at)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [crypto.randomUUID(), parsed.name, parsed.firmwareVersion, JSON.stringify(parsed.metadata), authToken]
    );

    res.status(201).json({ ...result.rows[0], authToken });
  } catch (err) {
    next(err);
  }
});
```

### 6. The Device Authentication Fix (Documented)

```typescript
// src/middleware/auth.middleware.ts
export async function deviceAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-device-token'];
  if (!token) {
    return res.status(401).json({ error: 'Device token required' });
  }

  const result = await pool.query(
    `SELECT * FROM devices WHERE auth_token = $1`,
    [token]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid device token' });
  }

  (req as any).deviceId = result.rows[0].id;
  next();
}
```

This fix requires `X-Device-Token` for all telemetry and command endpoints. Device spoofing is eliminated.

### 7. Scripts

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
| Persistence | Plain objects | PostgreSQL + InfluxDB |
| Telemetry | In-memory array | Time-series database |
| Device auth | None | Token-based authentication |
| Messaging | HTTP polling | MQTT pub/sub |
| Validation | None | Zod schemas |
| Types | None | TypeScript + generated types |
| Testing | None | Vitest + mocked services |
| Logging | console.log | Structured Pino |
| Module system | CommonJS | ESM |

## The Realization

> Junior: "I connected to InfluxDB and suddenly telemetry survives restarts. Then I realized: every layer we added — types, validation, tests, ESM — was necessary to get here without breaking everything."
>
> You: "Production isn't one big change. It's seven small evolutions, each fixing the pain of the last. The object taught us persistence matters. The unauthenticated endpoint taught us security matters. PostgreSQL + InfluxDB + MQTT is where all those lessons converge. In IoT, a missed sensor reading can mean a factory fire."

## Files in this project

```
A16-iot-platform/
├── src/
│   ├── index.ts              # Entry point (ESM), starts MQTT bridge
│   ├── app.ts                # Express app setup
│   ├── routes/
│   │   ├── device.routes.ts     # Device CRUD
│   │   ├── telemetry.routes.ts  # HTTP telemetry ingestion
│   │   ├── command.routes.ts    # Device commands
│   │   └── alert.routes.ts      # Alert rules
│   ├── services/
│   │   ├── device.service.ts    # Device management
│   │   ├── telemetry.service.ts # Data ingestion
│   │   ├── timeseries.service.ts # InfluxDB writes
│   │   ├── mqtt.service.ts      # MQTT bridge
│   │   ├── command.service.ts   # Command queue
│   │   └── alert.service.ts     # Rules engine
│   ├── middleware/
│   │   ├── auth.middleware.ts   # Device token auth
│   │   └── validate.middleware.ts
│   ├── utils/
│   │   ├── logger.ts            # Pino structured logging
│   │   ├── mqtt.utils.ts        # MQTT helpers
│   │   └── rule-engine.ts       # Threshold alerting
│   └── types/
│       ├── device.types.ts
│       └── telemetry.types.ts
├── migrations/                 # PostgreSQL migrations
├── mosquitto.conf              # MQTT broker config
├── .env.example
├── docker-compose.yml          # PostgreSQL + InfluxDB + Mosquitto + Redis
├── package.json                # ESM, scripts, dependencies
└── tsconfig.json               # NodeNext module resolution
```

## What You Learned

1. **Persistence evolution**: object → PostgreSQL + InfluxDB. Each step taught a lesson.
2. **Time-series databases**: Relational databases can't handle 10,000 writes/second. InfluxDB can.
3. **Tests document bugs**: The device spoofing test proves authentication is enforced.
4. **ESM is the future**: `"type": "module"` isn't a preference, it's a requirement for modern packages.
5. **MQTT over HTTP polling**: Battery life, bandwidth, and real-time updates demand pub/sub.
