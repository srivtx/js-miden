# A05: IoT Device Manager - API Reference

## Base URL

```
http://localhost:3000
```

## Endpoints

### Device Management

#### Register Device
```
POST /devices/register
Content-Type: application/json

{
  "name": "Living Room Sensor",
  "type": "temperature",
  "metadata": { "location": "1st floor" }
}

Response 201:
{
  "id": "dev_1234567890_abc123",
  "name": "Living Room Sensor",
  "type": "temperature",
  "status": "offline",
  "authToken": "tok_xxxxxxxxxx",
  ...
}
```

#### List Devices
```
GET /devices

Response 200: [Device]
```

#### Get Device
```
GET /devices/:id

Response 200: Device
Response 404: { error: "Device not found" }
```

#### Update Device
```
PATCH /devices/:id
Content-Type: application/json

{
  "metadata": { "location": "2nd floor" }
}

Response 200: Device
```

### Telemetry

#### Submit Telemetry
```
POST /telemetry
x-device-id: <device-id>
x-auth-token: <token>
Content-Type: application/json

{
  "temperature": 24.5,
  "humidity": 55
}

Response 201:
{
  "reading": TelemetryReading,
  "alerts": [Alert]
}
```

#### Get Device Alerts
```
GET /devices/:id/alerts

Response 200: [Alert]
```

### Heartbeat

#### Send Heartbeat
```
POST /heartbeat
x-device-id: <device-id>
x-auth-token: <token>

Response 200:
{
  "status": "ok",
  "device": Device
}
```

### Commands

#### Create Command
```
POST /devices/:id/commands
Content-Type: application/json

{
  "type": "turn_on",
  "payload": { "brightness": 100 }
}

Response 201: DeviceCommand
```

#### Get Pending Commands
```
GET /devices/:id/commands/pending

Response 200: [DeviceCommand]
```

#### Acknowledge Command
```
POST /commands/:id/acknowledge

Response 200: DeviceCommand
```

### Health Check
```
GET /health

Response 200: { "status": "ok" }
```
