# 04-data-models.md

## DeviceToken

| Field     | Type           | Description               |
|-----------|----------------|---------------------------|
| token     | string         | Platform device token     |
| platform  | 'ios'|'android' | Push provider target      |
| userId    | string?        | Optional owner reference  |
| createdAt | Date           | Registration timestamp    |

## PushNotification

| Field    | Type                  | Description                |
|----------|-----------------------|----------------------------|
| id       | string                | Notification ID            |
| title    | string                | Notification title         |
| body     | string                | Notification body          |
| data     | Record<string,unknown>| Payload metadata           |
| tokens   | string[]              | Target device tokens       |
| status   | string                | pending/sent/failed        |
| results  | PushResult[]          | Per-token delivery results |
| createdAt| Date                  | Creation timestamp         |

## PushResult

| Field   | Type    | Description           |
|---------|---------|-----------------------|
| token   | string  | Device token          |
| success | boolean | Delivery success      |
| error   | string? | Error message if any  |
