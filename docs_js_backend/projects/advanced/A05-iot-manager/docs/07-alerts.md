# A05: IoT Device Manager - Alerts

## Overview

The alert system monitors telemetry readings and generates alerts when sensor values exceed safe thresholds.

## Alert Types

| Type | Condition | Threshold |
|------|-----------|-----------|
| temperature_high | Temperature > 35°C | 35°C |
| temperature_critical | Temperature > 45°C | 45°C |
| humidity_high | Humidity > 80% | 80% |
| humidity_low | Humidity < 20% | 20% |

## Alert Lifecycle

1. **Generation**: Alert created when telemetry exceeds threshold
2. **Storage**: Alert saved to persistent storage
3. **Notification**: (Phase 2-3) Push to operators via WebSocket, email, or SMS
4. **Acknowledgment**: Operator acknowledges alert
5. **Resolution**: Alert remains until manually cleared or auto-expired

## Data Model

```typescript
interface Alert {
  id: string;
  deviceId: string;
  type: 'temperature_high' | 'temperature_critical' | 'humidity_high' | 'humidity_low';
  message: string;
  threshold: number;
  actualValue: number;
  timestamp: number;
  acknowledged: boolean;
}
```

## API

### Get Device Alerts
```
GET /devices/:id/alerts
```

### Acknowledge Alert
```
POST /devices/:id/alerts/:alertId/acknowledge
```

## Phase 2-3 Enhancements

- **Alert Deduplication**: Don't create duplicate alerts for the same condition within a time window
- **Escalation**: Unacknowledged critical alerts escalate after 15 minutes
- **Notification Channels**: Email, SMS, Slack, PagerDuty integration
- **Alert Rules Engine**: User-configurable thresholds per device or device group
