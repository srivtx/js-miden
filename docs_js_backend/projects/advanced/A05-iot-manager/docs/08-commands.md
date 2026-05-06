# A05: IoT Device Manager - Commands

## Overview

The command system allows operators to send instructions to remote devices. Devices poll for pending commands and acknowledge execution.

## Command Types

| Type | Description | Example Payload |
|------|-------------|-----------------|
| turn_on | Power on device | `{ "brightness": 100 }` |
| turn_off | Power off device | `{}` |
| reboot | Restart device | `{}` |
| update_config | Update device settings | `{ "interval": 30 }` |

## Command Lifecycle

```
Pending → Sent → Acknowledged
   ↓
Failed (if device doesn't respond)
```

## Flow

1. Operator creates command via `POST /devices/:id/commands`
2. Device polls `GET /devices/:id/commands/pending`
3. Device executes command
4. Device acknowledges via `POST /commands/:id/acknowledge`

## Data Model

```typescript
interface DeviceCommand {
  id: string;
  deviceId: string;
  type: 'turn_on' | 'turn_off' | 'reboot' | 'update_config';
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'acknowledged' | 'failed';
  createdAt: number;
  sentAt?: number;
  acknowledgedAt?: number;
}
```

## Phase 2-3 Enhancements

- **Command Retry**: Retry failed commands with exponential backoff
- **Command Batching**: Send multiple commands in one response
- **OTA Updates**: Support firmware update commands with progress tracking
- **Command Scheduling**: Schedule commands for future execution
- **Push Commands**: Use WebSockets or MQTT to push commands instead of polling
