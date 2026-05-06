# 01-overview.md

## WHAT

A push notification service that sends notifications to devices via FCM (Android) and APNS (iOS) mocks, registers device tokens, supports batch sending, and tracks delivery status.

## WHY

Mobile apps need real-time engagement. A centralized service handles platform differences, token management, batching for scale, and delivery analytics.

## HOW

- `POST /notifications/tokens` — register a device token
- `GET /notifications/tokens` — list registered tokens
- `POST /notifications/send` — send to one or more devices
- `POST /notifications/send-batch` — batch send notifications
- `GET /notifications/status/:id` — check delivery status
