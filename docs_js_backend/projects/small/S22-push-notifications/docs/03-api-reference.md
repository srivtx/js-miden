# 03-api-reference.md

## POST /notifications/tokens

Register a device token.

**Body:**
```json
{
  "token": "fcm_token_123",
  "platform": "android",
  "userId": "user-1"
}
```

## GET /notifications/tokens

List all registered tokens.

## POST /notifications/send

Send push notification to tokens.

**Body:**
```json
{
  "title": "Hello",
  "body": "World",
  "tokens": ["fcm_token_123"],
  "data": { "orderId": "123" }
}
```

## POST /notifications/send-batch

Send multiple notifications.

**Body:**
```json
{
  "notifications": [
    { "title": "A", "body": "B", "tokens": ["t1"] }
  ]
}
```

## GET /notifications/status/:id

Check delivery results.
