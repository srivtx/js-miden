# 03-api-reference.md

## POST /emails/send

Send an email. Accepts raw content or template rendering.

**Body:**
```json
{
  "to": "user@example.com",
  "from": "noreply@example.com",
  "subject": "Hello",
  "body": "World",
  "templateId": "welcome",
  "variables": { "name": "Alice" }
}
```

**Response:**
```json
{ "id": "abc123", "status": "queued" }
```

## GET /emails/queue

Returns counts by status.

## GET /emails/status/:id

Returns full email object with current status.

## GET /emails/templates

Lists available templates.

## POST /emails/process-queue

Manually triggers queue processing.
