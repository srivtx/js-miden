# Old vs. New

## Old Approach: Polling REST API

```javascript
// Old: Device polls server every 30 seconds
setInterval(() => {
  fetch('/api/check-commands').then(processCommands);
}, 30000);
```

Problems:
- High latency (average 15s delay)
- Massive server load from thousands of devices polling
- Battery drain on devices
- No real-time telemetry

## New Approach: MQTT Pub/Sub

```typescript
// New: Persistent connection, push-based
mqttClient.subscribe('devices/123/command');
mqttClient.publish('devices/123/telemetry', JSON.stringify(data));
```

Benefits:
- Sub-second latency
- Efficient resource usage (persistent TCP)
- Scales to millions of devices with broker clustering
- Bidirectional: telemetry out, commands in

## Evolution of Data Storage

| Aspect | Old (SQL) | New (Time-Series) |
|--------|-----------|-------------------|
| Schema | Rigid tables | Flexible tags/fields |
| Writes | Slow, transactional | Fast, append-only |
| Queries | Complex joins | Time-range aggregates |
| Retention | Manual cleanup | Automatic downsampling |
