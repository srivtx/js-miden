# A06: Content Moderation Pipeline - API Reference

## Base URL

```
http://localhost:3000
```

## Endpoints

### Content

#### Submit Content
```
POST /content/submit
Content-Type: application/json

{
  "userId": "user_123",
  "text": "Hello world!"
}

Response 201: ContentItem
```

#### List Content
```
GET /content

Response 200: [ContentItem]
```

#### Get Content
```
GET /content/:id

Response 200: ContentItem
Response 404: { error: "Content not found" }
```

### AI Check

#### Run AI Check
```
POST /content/:id/ai-check

Response 200:
{
  "contentId": "cnt_...",
  "result": {
    "flagged": true,
    "categories": ["spam"],
    "confidence": 0.85,
    "checkedAt": 1234567890
  }
}
```

### Human Review

#### Get Pending Reviews
```
GET /reviews/pending

Response 200: [HumanReviewQueueItem]
```

#### Submit Review Decision
```
POST /content/:id/review
Content-Type: application/json

{
  "reviewerId": "reviewer_1",
  "decision": "approved",
  "reason": "Looks fine"
}

Response 200: ContentItem
```

### Appeals

#### Create Appeal
```
POST /content/:id/appeal
Content-Type: application/json

{
  "userId": "user_123",
  "reason": "I think this is unfair"
}

Response 201: Appeal
```

#### Process Appeal
```
POST /appeals/:id/process
Content-Type: application/json

{
  "resolverId": "admin_1",
  "approved": true
}

Response 200: Appeal
```

#### Get Appeals for Content
```
GET /content/:id/appeals

Response 200: [Appeal]
```

### Audit

#### Get Audit Trail
```
GET /content/:id/audit

Response 200: [AuditLog]
```

### Publish

#### Publish Content
```
POST /content/:id/publish

Response 200: ContentItem
Response 400: { error: "Content must be approved before publishing" }
```

### Queue

#### Enqueue Job
```
POST /queue/enqueue
Content-Type: application/json

{
  "type": "ai_check",
  "contentId": "cnt_..."
}

Response 201: QueueJob
```

#### Get Next Job
```
GET /queue/next

Response 200: QueueJob | null
```

### Health Check
```
GET /health

Response 200: { "status": "ok" }
```
