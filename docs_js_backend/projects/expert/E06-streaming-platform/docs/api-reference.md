# E06 Streaming Platform — API Reference

## Upload Service (4001)
- `POST /uploads/` — Register upload metadata
- `GET /uploads/:id` — Get upload status
- `PATCH /uploads/:id/status` — Update upload status

## Transcode Service (4002)
- `POST /transcode/` — Create transcode job
- `GET /transcode/:id` — Get job status
- `PATCH /transcode/:id/status` — Update job status & outputs

## Stream Service (4003)
- `POST /stream/videos` — Register video for streaming
- `GET /stream/videos` — List videos
- `GET /stream/videos/:id` — Get video metadata
- `POST /stream/videos/:id/stream` — Start stream session
- `GET /stream/sessions/:id` — Get session info

## Recommendation Service (4004)
- `GET /recommendations/` — Get recommendations for user
- `POST /recommendations/generate` — Precompute recommendations

## User Service (4005)
- `POST /users/register` — Register
- `POST /users/login` — Login
- `GET /users/me` — Current user
- `POST /users/profiles` — Create profile (with maturity level)

## Search Service (4006)
- `GET /search?q=...&type=...` — Search content
- `POST /search/index` — Index content

## Subscription Service (4007)
- `POST /subscriptions/` — Create subscription
- `GET /subscriptions/me` — Get active subscription
- `GET /subscriptions/user/:userId` — Get user subscription

## Analytics Service (4008)
- `POST /analytics/events` — Log watch event
- `GET /analytics/history/:profileId` — Watch history
- `GET /analytics/continue-watching/:profileId` — Resume points
