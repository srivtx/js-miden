# A05: IoT Device Manager - Heartbeat

## Overview

The heartbeat system tracks whether devices are online or offline. Devices must send periodic heartbeats; if no heartbeat is received within 5 minutes, the device is marked offline.

## How It Works

### Heartbeat Endpoint

Devices send `POST /heartbeat` to update their `lastSeen` timestamp and set status to `online`.

### Offline Detection

A background monitor runs every 30 seconds:

```typescript
for (const device of devices) {
  if (device.status === 'online') {
    // Simulate async I/O
    await delay(15);
    
    if (Date.now() - device.lastSeen > 5 * 60 * 1000) {
      await markDeviceOffline(device.id);
    }
  }
}
```

## Known Bug: Heartbeat Race Condition

### The Problem

The offline check loop has a race condition:

1. Monitor reads device list and `lastSeen` values
2. Monitor yields (awaits 15ms delay) for each device
3. During the yield, Device A sends a heartbeat
4. Heartbeat updates `lastSeen` to now and sets status to `online`
5. Monitor resumes with the STALE `lastSeen` from step 1
6. Monitor incorrectly marks Device A as offline
7. The fresh "online" status from the heartbeat is overwritten

### Impact

- Devices incorrectly shown as offline
- Missing telemetry alerts (offline devices are ignored)
- Command delivery failures

### Why It Happens

```typescript
// BUGGY CODE:
for (const device of devices) {
  await delay(15); // Yield allows other code to run
  // device.lastSeen is stale - may have been updated during delay
  if (Date.now() - device.lastSeen > THRESHOLD) {
    await updateDevice(device.id, { status: 'offline' });
  }
}
```

### Recommended Fix

Re-fetch the device before marking offline, or use atomic operations:

```typescript
// FIX: Re-verify lastSeen before updating
for (const device of devices) {
  await delay(15);
  const current = await storage.getDevice(device.id);
  if (current?.status === 'online' && Date.now() - current.lastSeen > THRESHOLD) {
    await storage.updateDevice(device.id, { status: 'offline' });
  }
}
```

## Phase 2-3: Production Heartbeat Patterns

### Redis TTL Keys
- Set a Redis key with 5-minute TTL on each heartbeat
- Key expiration = device offline
- Eliminates polling loops entirely

### Scheduled Jobs
- Use BullMQ or node-cron for distributed scheduling
- Prevents multiple server instances from conflicting

### MQTT Last Will and Testament
- MQTT brokers automatically mark devices offline on disconnect
- No server-side polling needed
