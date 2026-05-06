# S29 Notification Dispatcher

Multi-channel notification dispatcher supporting email, SMS, push, and in-app WebSocket channels.

## Features

- Channel adapters: SMTP, Twilio, FCM, WebSocket
- Template engine with variable substitution
- User preference management (opt-out per channel)

## Intentional Bug

Dispatcher sends to ALL channels regardless of user opt-out preferences.

## Scripts

```bash
npm run dev       # Start development server
npm test          # Run Vitest tests (includes bug reproduction)
npm run build     # Compile TypeScript
```

## Docker

```bash
docker-compose up -d
```
