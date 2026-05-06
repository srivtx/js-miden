# WHAT: Service Discovery

Service Discovery is the mechanism by which services in a microservices architecture find and communicate with each other without hardcoding network locations.

## Core Responsibilities

1. **Registration**: Services announce themselves when they start.
2. **Discovery**: Clients look up the current location of a service by name.
3. **Health Tracking**: Ensure only healthy, running instances are discoverable.

## What This Project Does

This project implements a simple service registry that:

- Accepts service registrations (name + URL)
- Allows services to send periodic heartbeats
- Automatically removes services that fail to heartbeat
- Responds to discovery queries with a list of healthy instances

## Simplified Architecture

```
┌──────────┐     Register      ┌──────────┐
│ Service  │ ─────────────────▶ │ Registry │
│  User    │     Heartbeat      │  :3000   │
└──────────┘ ◀───────────────── └──────────┘
                              ▲
┌──────────┐   Discover       │
│ Service  │ ─────────────────┘
│  Order   │
└──────────┘
```

## Key Terms

| Term | Definition |
|------|------------|
| Registry | A database of currently available service instances. |
| Heartbeat | A periodic signal indicating a service is still alive. |
| Discovery | The act of looking up the address of a service by name. |
