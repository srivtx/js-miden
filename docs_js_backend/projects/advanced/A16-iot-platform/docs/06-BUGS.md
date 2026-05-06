# Bug Analysis

## Bug: No Device Authentication

### Location
- `src/middleware/auth.middleware.ts` - `authenticateDevice()` trusts header/body deviceId
- `src/services/mqtt.service.ts` - `handleMessage()` trusts topic-derived deviceId
- `src/controllers/telemetry.controller.ts` - `ingestTelemetry()` accepts any deviceId

### Description
The system accepts a `deviceId` from HTTP headers, request body, or MQTT topic without any cryptographic verification. There is no password, token, certificate, or HMAC validation.

### Impact
- **Data Spoofing**: Attacker can publish fake telemetry as a legitimate device.
- **Command Injection**: If command endpoints also lack auth, attackers could send commands to other devices.
- **Alert Fatigue**: False telemetry triggers false alerts, causing operational desensitization.
- **Billing Fraud**: If telemetry drives usage billing, spoofed data leads to incorrect charges.

### Reproduction
```typescript
// Test: telemetry.test.ts
const spoofedDeviceId = 'fake-device-123';

const res = await request(app)
  .post('/api/telemetry')
  .send({
    deviceId: spoofedDeviceId,
    measurements: { temperature: 99.9 },
  });

expect(res.status).toBe(201); // BUG: Should be 401/403
```

### Fix Strategy

1. **Provision Unique Credentials**: Each device gets a unique API key or certificate at registration.
2. **Verify on Ingestion**: HTTP middleware validates JWT or HMAC signature.
3. **MQTT TLS**: Enable client certificate authentication on Mosquitto.
4. **Topic ACLs**: Broker enforces that device `123` can only publish to `devices/123/+`.

```typescript
// Example: HMAC verification
function verifyDeviceAuth(deviceId: string, payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```
