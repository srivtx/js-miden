# A05: IoT Device Manager - Overview

## Description

The IoT Device Manager is an advanced backend system for managing IoT devices at scale. It handles device registration, telemetry ingestion, heartbeat monitoring, alert generation, and remote command execution.

## Features

- **Device Registration**: Each device gets a unique ID and authentication token
- **Telemetry Ingestion**: Receives temperature and humidity readings from devices
- **Alert System**: Automatic alerts when temperature exceeds configurable thresholds
- **Heartbeat Monitoring**: Tracks device online/offline status with a 5-minute timeout
- **Remote Commands**: Send commands to devices (turn on/off, reboot, update config)

## Project Structure

```
A05-iot-manager/
  src/
    index.ts        # Express application and routes
    device.ts       # Device registration and management
    telemetry.ts    # Telemetry data handling
    auth.ts         # Device authentication middleware
    heartbeat.ts    # Heartbeat and offline detection
    alert.ts        # Alert generation and management
    command.ts      # Device command queue
    storage.ts      # In-memory storage layer
  tests/            # Comprehensive test suite
  docs/             # Documentation
```

## Quick Start

```bash
npm install
npm run dev
npm test
```

## Technology Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 5
- **Language**: TypeScript (ESM)
- **Testing**: Vitest + Supertest
