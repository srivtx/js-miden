# API Reference

## POST /api/jobs

Create a new background job.

**Request Body:**
```json
{
  "type": "video.transcode",
  "payload": {
    "inputPath": "/uploads/video.mp4",
    "formats": ["720p", "1080p", "480p"]
  }
}
```

**Response (new job):**
```json
{
  "jobId": "uuid-here",
  "status": "pending"
}
```

**Response (cached):**
```json
{
  "job": { "id": "uuid-here", "status": "completed", "result": {...} },
  "cached": true
}
```

## GET /api/jobs/:id

Get job details.

**Response:**
```json
{
  "job": {
    "id": "uuid-here",
    "type": "video.transcode",
    "status": "processing",
    "progress": 33,
    "result": null,
    "error": null,
    "attempt_count": 1
  }
}
```

## GET /api/jobs/:id/progress

Get job progress percentage.

**Response:**
```json
{
  "progress": 33,
  "status": "processing"
}
```

## POST /api/jobs-no-idempotency (Bug Demo)

Always creates a new job regardless of duplicates.
