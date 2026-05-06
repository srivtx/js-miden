# v6 — Switching to ESM

You're trying to use `mqtt` library for IoT messaging. The latest version is ESM-only.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module mqtt not supported
```

Your IoT manager is CommonJS. Modern IoT libraries are ESM. Time to switch.

## The Fix: Go All-In on ESM

```json
// package.json
{
  "type": "module"
}
```

```ts
// mqtt-client.ts
import mqtt from 'mqtt';

const client = mqtt.connect(process.env.MQTT_BROKER_URL);

client.on('connect', () => {
  logger.info('Connected to MQTT broker');
  client.subscribe('devices/+/telemetry');
  client.subscribe('devices/+/status');
});

client.on('message', (topic, message) => {
  const payload = JSON.parse(message.toString());
  handleMqttMessage(topic, payload);
});
```

## Why ESM?

- **Modern IoT libraries work** — `mqtt`, `aedes` (MQTT broker), ESM-only packages
- **Top-level await** — clean async initialization for broker connections
- **Static analysis** — bundlers can tree-shake when you split registry/telemetry/command services
- **`node:` prefixes** — clear built-in vs npm imports

## Migration

- Add `"type": "module"` to `package.json`
- Use `.js` extensions in all imports
- Replace `__dirname` with `import.meta.url`

**Next:** Production setup — MQTT, telemetry ingestion, command dispatch, and alerting.
