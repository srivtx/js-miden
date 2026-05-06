# 05-configuration.md

## Environment Variables

| Variable    | Default              | Description               |
|-------------|----------------------|---------------------------|
| PORT        | 3000                 | HTTP server port          |
| FCM_API_KEY | mock-fcm-key         | Firebase Cloud Messaging  |
| APNS_KEY_ID | mock-apns-key        | Apple Push Notification   |
| REDIS_URL   | redis://localhost:6379 | Token storage cache     |

## Provider Setup

Phase 1 uses mock providers. Replace `mockFcmSend` and `mockApnsSend` with real SDK calls.

## Docker

```bash
docker-compose up
```

Runs app with Redis for token storage.
